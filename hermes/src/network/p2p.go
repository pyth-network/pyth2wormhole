// This package is derived from the node/pkgs/p2p.go file in the Wormhole project.
//
// This file has been stripped down to only what is necessary to participate in
// P2P and receive message and VAA observations from the network. It is not
// intended to be used as a full node implementation and can be replaced with
// Rust code once QUIC+TLS stable support is available in rust-libp2p.

package main

// #include <stdlib.h>
//
// // A structure containing Wormhole VAA observations. This must match on both
// // the Go and Rust side.
// typedef struct {
//     char const *vaa;
//     size_t      vaa_len;
// } observation_t;
//
// // A small proxy method to invoke the Rust callback from CGo. This is due
// // to the fact that CGo does not support calling C functions directly from
// // Go. By passing it to this proxy Go is able to suspend the GC correctly
// // and the callback is invoked from a separate thread.
// typedef void (*callback_t)(observation_t);
// static void invoke(callback_t f, observation_t o) { f(o); }
import "C"

import (
	"context"
	"fmt"

	"github.com/libp2p/go-libp2p"
	"github.com/libp2p/go-libp2p/core/crypto"
	"github.com/libp2p/go-libp2p/core/host"
	"github.com/libp2p/go-libp2p/core/peer"
	"github.com/libp2p/go-libp2p/core/protocol"
	"github.com/libp2p/go-libp2p/core/routing"
	"github.com/libp2p/go-libp2p/p2p/net/connmgr"
	"github.com/multiformats/go-multiaddr"
	"google.golang.org/protobuf/proto"

	dht "github.com/libp2p/go-libp2p-kad-dht"
	pubsub "github.com/libp2p/go-libp2p-pubsub"
	libp2ptls "github.com/libp2p/go-libp2p/p2p/security/tls"
	libp2pquic "github.com/libp2p/go-libp2p/p2p/transport/quic"
)

//export RegisterObservationCallback
func RegisterObservationCallback(f C.callback_t) {
	go func() {
		ctx := context.Background()

		// Setup base network configuration.
		networkID := "/wormhole/testnet/2/1"
		priv, _, err := crypto.GenerateKeyPair(crypto.Ed25519, -1)
		bootstrapPeers := []string{
			//"/dns4/wormhole-mainnet-v2-bootstrap.certus.one/udp/8999/quic/p2p/12D3KooWQp644DK27fd3d4Km3jr7gHiuJJ5ZGmy8hH4py7fP4FP7",
			"/dns4/wormhole-testnet-v2-bootstrap.certus.one/udp/8999/quic/p2p/12D3KooWAkB9ynDur1Jtoa97LBUp8RXdhzS5uHgAfdTquJbrbN7i",
		}

		// Setup libp2p Connection Manager.
		mgr, err := connmgr.NewConnManager(
			100,
			400,
			connmgr.WithGracePeriod(0),
		)

		if err != nil {
			err := fmt.Errorf("Failed to create connection manager: %w", err)
			fmt.Println(err)
			return
		}

		// Setup libp2p Reactor.
		h, err := libp2p.New(
			libp2p.Identity(priv),
			libp2p.ListenAddrStrings(
				"/ip4/0.0.0.0/udp/30910/quic",
				"/ip6/::/udp/30910/quic",
			),
			libp2p.Security(libp2ptls.ID, libp2ptls.New),
			libp2p.Transport(libp2pquic.NewTransport),
			libp2p.ConnectionManager(mgr),
			libp2p.Routing(func(h host.Host) (routing.PeerRouting, error) {
				bootstrappers := make([]peer.AddrInfo, 0)
				for _, addr := range bootstrapPeers {
					ma, err := multiaddr.NewMultiaddr(addr)
					if err != nil {
						continue
					}

					pi, err := peer.AddrInfoFromP2pAddr(ma)
					if err != nil || pi.ID == h.ID() {
						continue
					}

					bootstrappers = append(bootstrappers, *pi)
				}
				idht, err := dht.New(ctx, h, dht.Mode(dht.ModeServer),
					dht.ProtocolPrefix(protocol.ID("/"+networkID)),
					dht.BootstrapPeers(bootstrappers...),
				)
				return idht, err
			}),
		)

		if err != nil {
			err := fmt.Errorf("Failed to create libp2p host: %w", err)
			fmt.Println(err)
			return
		}

		topic := fmt.Sprintf("%s/%s", networkID, "broadcast")
		ps, err := pubsub.NewGossipSub(ctx, h)
		if err != nil {
			err := fmt.Errorf("Failed to create Pubsub: %w", err)
			fmt.Println(err)
			return
		}

		th, err := ps.Join(topic)
		if err != nil {
			err := fmt.Errorf("Failed to join topic: %w", err)
			fmt.Println(err)
			return
		}

		sub, err := th.Subscribe()
		if err != nil {
			err := fmt.Errorf("Failed to subscribe topic: %w", err)
			fmt.Println(err)
			return
		}

		for {
			for {
				select {
				case <-ctx.Done():
					return
				default:
					envelope, err := sub.Next(ctx)
					if err != nil {
						err := fmt.Errorf("Failed to receive Pubsub message: %w", err)
						fmt.Println(err)
						return
					}

					// Definition for GossipMessage is generated by Protobuf, see `p2p.proto`.
					var msg GossipMessage
					err = proto.Unmarshal(envelope.Data, &msg)

					switch msg.Message.(type) {
					case *GossipMessage_SignedObservation:
					case *GossipMessage_SignedVaaWithQuorum:
						vaaBytes := msg.GetSignedVaaWithQuorum().GetVaa()
						cBytes := C.CBytes(vaaBytes)
						defer C.free(cBytes)
						C.invoke(f, C.observation_t{
							vaa:     (*C.char)(cBytes),
							vaa_len: C.size_t(len(vaaBytes)),
						})
					}
				}
			}
		}
	}()
}

func main() {
}
