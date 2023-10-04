use {
    super::types::{
        PriceIdInput,
        RpcPriceFeed,
    },
    crate::{
        aggregate::{
            AggregationEvent,
            RequestTime,
        },
        state::State,
    },
    anyhow::{
        anyhow,
        Result,
    },
    axum::{
        extract::{
            ws::{
                Message,
                WebSocket,
                WebSocketUpgrade,
            },
            ConnectInfo,
            State as AxumState,
        },
        response::IntoResponse,
    },
    dashmap::DashMap,
    futures::{
        future::join_all,
        stream::{
            SplitSink,
            SplitStream,
        },
        SinkExt,
        StreamExt,
    },
    governor::{
        DefaultKeyedRateLimiter,
        Quota,
        RateLimiter,
    },
    ipnet::IpNet,
    nonzero_ext::nonzero,
    pyth_sdk::PriceIdentifier,
    serde::{
        Deserialize,
        Serialize,
    },
    std::{
        collections::HashMap,
        net::{
            IpAddr,
            SocketAddr,
        },
        num::NonZeroU32,
        sync::{
            atomic::{
                AtomicUsize,
                Ordering,
            },
            Arc,
        },
        time::Duration,
    },
    tokio::sync::mpsc,
};

const PING_INTERVAL_DURATION: Duration = Duration::from_secs(30);
const NOTIFICATIONS_CHAN_LEN: usize = 1000;
const MAX_CLIENT_MESSAGE_SIZE: usize = 100 * 1024; // 100 KiB

/// The maximum number of bytes that can be sent per second per IP address.
/// If the limit is exceeded, the connection is closed.
const BYTES_LIMIT_PER_IP_PER_SECOND: u32 = 256 * 1024; // 256 KiB

#[derive(Clone)]
pub struct PriceFeedClientConfig {
    verbose:            bool,
    binary:             bool,
    allow_out_of_order: bool,
}

pub struct WsState {
    pub subscriber_counter:    AtomicUsize,
    pub subscribers:           DashMap<SubscriberId, mpsc::Sender<AggregationEvent>>,
    pub bytes_limit_whitelist: Vec<IpNet>,
    pub rate_limiter:          DefaultKeyedRateLimiter<IpAddr>,
}

impl WsState {
    pub fn new(whitelist: Vec<IpNet>) -> Self {
        Self {
            subscriber_counter:    AtomicUsize::new(0),
            subscribers:           DashMap::new(),
            rate_limiter:          RateLimiter::dashmap(Quota::per_second(nonzero!(
                BYTES_LIMIT_PER_IP_PER_SECOND
            ))),
            bytes_limit_whitelist: whitelist,
        }
    }
}


#[derive(Deserialize, Debug, Clone)]
#[serde(tag = "type")]
enum ClientMessage {
    #[serde(rename = "subscribe")]
    Subscribe {
        ids:                Vec<PriceIdInput>,
        #[serde(default)]
        verbose:            bool,
        #[serde(default)]
        binary:             bool,
        #[serde(default)]
        allow_out_of_order: bool,
    },
    #[serde(rename = "unsubscribe")]
    Unsubscribe { ids: Vec<PriceIdInput> },
}


#[derive(Serialize, Debug, Clone)]
#[serde(tag = "type")]
enum ServerMessage {
    #[serde(rename = "response")]
    Response(ServerResponseMessage),
    #[serde(rename = "price_update")]
    PriceUpdate { price_feed: RpcPriceFeed },
}

#[derive(Serialize, Debug, Clone)]
#[serde(tag = "status")]
enum ServerResponseMessage {
    #[serde(rename = "success")]
    Success,
    #[serde(rename = "error")]
    Err { error: String },
}

pub async fn ws_route_handler(
    ws: WebSocketUpgrade,
    AxumState(state): AxumState<super::ApiState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
) -> impl IntoResponse {
    ws.max_message_size(MAX_CLIENT_MESSAGE_SIZE)
        .on_upgrade(move |socket| websocket_handler(socket, state, addr))
}

#[tracing::instrument(skip(stream, state, addr))]
async fn websocket_handler(stream: WebSocket, state: super::ApiState, addr: SocketAddr) {
    let ws_state = state.ws.clone();
    let id = ws_state.subscriber_counter.fetch_add(1, Ordering::SeqCst);
    tracing::debug!(id, %addr, "New Websocket Connection");

    let (notify_sender, notify_receiver) = mpsc::channel(NOTIFICATIONS_CHAN_LEN);
    let (sender, receiver) = stream.split();
    let mut subscriber = Subscriber::new(
        id,
        addr.ip(),
        state.state.clone(),
        state.ws.clone(),
        notify_receiver,
        receiver,
        sender,
    );

    ws_state.subscribers.insert(id, notify_sender);
    subscriber.run().await;
}

pub type SubscriberId = usize;

/// Subscriber is an actor that handles a single websocket connection.
/// It listens to the store for updates and sends them to the client.
pub struct Subscriber {
    id:                      SubscriberId,
    ip_addr:                 IpAddr,
    closed:                  bool,
    store:                   Arc<State>,
    ws_state:                Arc<WsState>,
    notify_receiver:         mpsc::Receiver<AggregationEvent>,
    receiver:                SplitStream<WebSocket>,
    sender:                  SplitSink<WebSocket, Message>,
    price_feeds_with_config: HashMap<PriceIdentifier, PriceFeedClientConfig>,
    ping_interval:           tokio::time::Interval,
    responded_to_ping:       bool,
}

impl Subscriber {
    pub fn new(
        id: SubscriberId,
        ip_addr: IpAddr,
        store: Arc<State>,
        ws_state: Arc<WsState>,
        notify_receiver: mpsc::Receiver<AggregationEvent>,
        receiver: SplitStream<WebSocket>,
        sender: SplitSink<WebSocket, Message>,
    ) -> Self {
        Self {
            id,
            ip_addr,
            closed: false,
            store,
            ws_state,
            notify_receiver,
            receiver,
            sender,
            price_feeds_with_config: HashMap::new(),
            ping_interval: tokio::time::interval(PING_INTERVAL_DURATION),
            responded_to_ping: true, // We start with true so we don't close the connection immediately
        }
    }

    #[tracing::instrument(skip(self))]
    pub async fn run(&mut self) {
        while !self.closed {
            if let Err(e) = self.handle_next().await {
                tracing::debug!(subscriber = self.id, error = ?e, "Error Handling Subscriber Message.");
                break;
            }
        }
    }

    async fn handle_next(&mut self) -> Result<()> {
        tokio::select! {
            maybe_update_feeds_event = self.notify_receiver.recv() => {
                match maybe_update_feeds_event {
                    Some(event) => self.handle_price_feeds_update(event).await,
                    None => Err(anyhow!("Update channel closed. This should never happen. Closing connection."))
                }
            },
            maybe_message_or_err = self.receiver.next() => {
                self.handle_client_message(
                    maybe_message_or_err.ok_or(anyhow!("Client channel is closed"))??
                ).await
            },
            _  = self.ping_interval.tick() => {
                if !self.responded_to_ping {
                    return Err(anyhow!("Subscriber did not respond to ping. Closing connection."));
                }
                self.responded_to_ping = false;
                self.sender.send(Message::Ping(vec![])).await?;
                Ok(())
            }
        }
    }

    async fn handle_price_feeds_update(&mut self, event: AggregationEvent) -> Result<()> {
        let price_feed_ids = self
            .price_feeds_with_config
            .keys()
            .cloned()
            .collect::<Vec<_>>();
        for update in crate::aggregate::get_price_feeds_with_update_data(
            &*self.store,
            &price_feed_ids,
            RequestTime::AtSlot(event.slot()),
        )
        .await
        .map_err(|e| {
            tracing::warn!(
                "Failed to get price feeds {:?} with update data: {:?}",
                price_feed_ids,
                e
            );
            e
        })?
        .price_feeds
        {
            let config = self
                .price_feeds_with_config
                .get(&update.price_feed.id)
                .ok_or(anyhow::anyhow!(
                    "Config missing, price feed list was poisoned during iteration."
                ))?;

            if let AggregationEvent::OutOfOrder { slot: _ } = event {
                if !config.allow_out_of_order {
                    continue;
                }
            }

            let message = serde_json::to_string(&ServerMessage::PriceUpdate {
                price_feed: RpcPriceFeed::from_price_feed_update(
                    update,
                    config.verbose,
                    config.binary,
                ),
            })?;

            // Close the connection if rate limit is exceeded and the ip is not whitelisted.
            if !self
                .ws_state
                .bytes_limit_whitelist
                .contains(&self.ip_addr.into())
                && self.ws_state.rate_limiter.check_key_n(
                    &self.ip_addr,
                    NonZeroU32::new(message.len().try_into()?).ok_or(anyhow!("Empty message"))?,
                ) != Ok(Ok(()))
            {
                tracing::info!(
                    self.id,
                    ip = %self.ip_addr,
                    "Rate limit exceeded. Closing connection.",
                );
                self.sender
                    .send(
                        serde_json::to_string(&ServerResponseMessage::Err {
                            error: "Rate limit exceeded".to_string(),
                        })?
                        .into(),
                    )
                    .await?;
                self.sender.close().await?;
                self.closed = true;
                return Ok(());
            }

            // `sender.feed` buffers a message to the client but does not flush it, so we can send
            // multiple messages and flush them all at once.
            self.sender.feed(message.into()).await?;
        }

        self.sender.flush().await?;
        Ok(())
    }

    #[tracing::instrument(skip(self, message))]
    async fn handle_client_message(&mut self, message: Message) -> Result<()> {
        let maybe_client_message = match message {
            Message::Close(_) => {
                // Closing the connection. We don't remove it from the subscribers
                // list, instead when the Subscriber struct is dropped the channel
                // to subscribers list will be closed and it will eventually get
                // removed.
                tracing::trace!(id = self.id, "Subscriber Closed Connection.");

                // Send the close message to gracefully shut down the connection
                // Otherwise the client might get an abnormal Websocket closure
                // error.
                self.sender.close().await?;
                self.closed = true;
                return Ok(());
            }
            Message::Text(text) => serde_json::from_str::<ClientMessage>(&text),
            Message::Binary(data) => serde_json::from_slice::<ClientMessage>(&data),
            Message::Ping(_) => {
                // Axum will send Pong automatically
                return Ok(());
            }
            Message::Pong(_) => {
                self.responded_to_ping = true;
                return Ok(());
            }
        };

        match maybe_client_message {
            Err(e) => {
                self.sender
                    .send(
                        serde_json::to_string(&ServerMessage::Response(
                            ServerResponseMessage::Err {
                                error: e.to_string(),
                            },
                        ))?
                        .into(),
                    )
                    .await?;
                return Ok(());
            }

            Ok(ClientMessage::Subscribe {
                ids,
                verbose,
                binary,
                allow_out_of_order,
            }) => {
                let price_ids: Vec<PriceIdentifier> = ids.into_iter().map(|id| id.into()).collect();
                let available_price_ids = crate::aggregate::get_price_feed_ids(&*self.store).await;

                let not_found_price_ids: Vec<&PriceIdentifier> = price_ids
                    .iter()
                    .filter(|price_id| !available_price_ids.contains(price_id))
                    .collect();

                // If there is a single price id that is not found, we don't subscribe to any of the
                // asked correct price feed ids and return an error to be more explicit and clear.
                if !not_found_price_ids.is_empty() {
                    self.sender
                        .send(
                            serde_json::to_string(&ServerMessage::Response(
                                ServerResponseMessage::Err {
                                    error: format!(
                                        "Price feed(s) with id(s) {:?} not found",
                                        not_found_price_ids
                                    ),
                                },
                            ))?
                            .into(),
                        )
                        .await?;
                    return Ok(());
                } else {
                    for price_id in price_ids {
                        self.price_feeds_with_config.insert(
                            price_id,
                            PriceFeedClientConfig {
                                verbose,
                                binary,
                                allow_out_of_order,
                            },
                        );
                    }
                }
            }
            Ok(ClientMessage::Unsubscribe { ids }) => {
                for id in ids {
                    let price_id: PriceIdentifier = id.into();
                    self.price_feeds_with_config.remove(&price_id);
                }
            }
        }

        self.sender
            .send(
                serde_json::to_string(&ServerMessage::Response(ServerResponseMessage::Success))?
                    .into(),
            )
            .await?;

        Ok(())
    }
}

pub async fn notify_updates(ws_state: Arc<WsState>, event: AggregationEvent) {
    let closed_subscribers: Vec<Option<SubscriberId>> =
        join_all(ws_state.subscribers.iter_mut().map(|subscriber| {
            let event = event.clone();
            async move {
                match subscriber.send(event).await {
                    Ok(_) => None,
                    Err(_) => {
                        // An error here indicates the channel is closed (which may happen either when the
                        // client has sent Message::Close or some other abrupt disconnection). We remove
                        // subscribers only when send fails so we can handle closure only once when we are
                        // able to see send() fail.
                        Some(*subscriber.key())
                    }
                }
            }
        }))
        .await;

    // Remove closed_subscribers from ws_state
    closed_subscribers.into_iter().for_each(|id| {
        if let Some(id) = id {
            ws_state.subscribers.remove(&id);
        }
    });

    // Clean the bytes limiting dictionary
    ws_state.rate_limiter.retain_recent();
}
