package ethereum

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	eth_common "github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/ethclient"
	"go.uber.org/zap"

	"github.com/certusone/wormhole/bridge/pkg/common"
	"github.com/certusone/wormhole/bridge/pkg/ethereum/abi"
	"github.com/certusone/wormhole/bridge/pkg/supervisor"
	"github.com/certusone/wormhole/bridge/pkg/vaa"
)

type (
	EthBridgeWatcher struct {
		url              string
		bridge           eth_common.Address
		minConfirmations uint64

		pendingLocks      map[eth_common.Hash]*pendingLock
		pendingLocksGuard sync.Mutex

		lockChan chan *common.ChainLock
		setChan  chan *common.GuardianSet
	}

	pendingLock struct {
		lock   *common.ChainLock
		height uint64
	}
)

func NewEthBridgeWatcher(url string, bridge eth_common.Address, minConfirmations uint64, lockEvents chan *common.ChainLock, setEvents chan *common.GuardianSet) *EthBridgeWatcher {
	return &EthBridgeWatcher{url: url, bridge: bridge, minConfirmations: minConfirmations, lockChan: lockEvents, setChan: setEvents, pendingLocks: map[eth_common.Hash]*pendingLock{}}
}

func (e *EthBridgeWatcher) Run(ctx context.Context) error {
	timeout, _ := context.WithTimeout(ctx, 15 * time.Second)
	c, err := ethclient.DialContext(timeout, e.url)
	if err != nil {
		return fmt.Errorf("dialing eth client failed: %w", err)
	}

	f, err := abi.NewAbiFilterer(e.bridge, c)
	if err != nil {
		return fmt.Errorf("could not create wormhole bridge filter: %w", err)
	}

	caller, err := abi.NewAbiCaller(e.bridge, c)
	if err != nil {
		panic(err)
	}

	// Timeout for initializing subscriptions
	timeout, _ = context.WithTimeout(ctx, 15 * time.Second)

	// Subscribe to new token lockups
	tokensLockedC := make(chan *abi.AbiLogTokensLocked, 2)
	tokensLockedSub, err := f.WatchLogTokensLocked(&bind.WatchOpts{Context: timeout}, tokensLockedC, nil, nil)
	if err != nil {
		return fmt.Errorf("failed to subscribe to token lockup events: %w", err)
	}
	defer tokensLockedSub.Unsubscribe()

	// Subscribe to guardian set changes
	guardianSetC := make(chan *abi.AbiLogGuardianSetChanged, 2)
	guardianSetEvent, err := f.WatchLogGuardianSetChanged(&bind.WatchOpts{Context: timeout}, guardianSetC)
	if err != nil {
		return fmt.Errorf("failed to subscribe to guardian set events: %w", err)
	}
	defer tokensLockedSub.Unsubscribe()

	errC := make(chan error)
	logger := supervisor.Logger(ctx)

	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case e := <-tokensLockedSub.Err():
				errC <- fmt.Errorf("error while processing token lockup subscription: %w", e)
				return
			case e := <-guardianSetEvent.Err():
				errC <- fmt.Errorf("error while processing guardian set subscription: %w", e)
				return
			case ev := <-tokensLockedC:
				lock := &common.ChainLock{
					TxHash:        ev.Raw.TxHash,
					SourceAddress: ev.Sender,
					TargetAddress: ev.Recipient,
					SourceChain:   vaa.ChainIDEthereum,
					TargetChain:   vaa.ChainID(ev.TargetChain),
					TokenChain:    vaa.ChainID(ev.TokenChain),
					TokenAddress:  ev.Token,
					Amount:        ev.Amount,
				}

				logger.Info("found new lockup transaction", zap.Stringer("tx", ev.Raw.TxHash),
					zap.Uint64("number", ev.Raw.BlockNumber))
				e.pendingLocksGuard.Lock()
				e.pendingLocks[ev.Raw.TxHash] = &pendingLock{
					lock:   lock,
					height: ev.Raw.BlockNumber,
				}
				e.pendingLocksGuard.Unlock()
			case ev := <-guardianSetC:
				logger.Info("guardian set has changed, fetching new value",
					zap.Uint32("new_index", ev.NewGuardianIndex))

				gs, err := caller.GetGuardianSet(&bind.CallOpts{Context: timeout}, ev.NewGuardianIndex)
				if err != nil {
					errC <- fmt.Errorf("error requesting new guardian set value: %w", err)
					return
				}

				logger.Info("new guardian set fetched", zap.Any("value", gs), zap.Uint32("index", ev.NewGuardianIndex))
				e.setChan <- &common.GuardianSet{
					Keys: gs.Keys,
					Index: ev.NewGuardianIndex,
				}
			}
		}
	}()

	// Watch headers
	headSink := make(chan *types.Header, 2)
	headerSubscription, err := c.SubscribeNewHead(ctx, headSink)
	if err != nil {
		return fmt.Errorf("failed to subscribe to header events: %w", err)
	}
	defer headerSubscription.Unsubscribe()

	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case e := <-headerSubscription.Err():
				errC <- fmt.Errorf("error while processing header subscription: %w", e)
				return
			case ev := <-headSink:
				start := time.Now()
				logger.Info("processing new header", zap.Stringer("number", ev.Number))
				e.pendingLocksGuard.Lock()

				blockNumberU := ev.Number.Uint64()
				for hash, pLock := range e.pendingLocks {

					// Transaction was dropped and never picked up again
					if pLock.height+4*e.minConfirmations <= blockNumberU {
						logger.Debug("lockup timed out", zap.Stringer("tx", pLock.lock.TxHash),
							zap.Stringer("number", ev.Number))
						delete(e.pendingLocks, hash)
						continue
					}

					// Transaction is now ready
					if pLock.height+e.minConfirmations <= ev.Number.Uint64() {
						logger.Debug("lockup confirmed", zap.Stringer("tx", pLock.lock.TxHash),
							zap.Stringer("number", ev.Number))
						delete(e.pendingLocks, hash)
						e.lockChan <- pLock.lock
					}
				}

				e.pendingLocksGuard.Unlock()
				logger.Info("processed new header", zap.Stringer("number", ev.Number),
					zap.Duration("took", time.Since(start)))
			}
		}
	}()

	supervisor.Signal(ctx, supervisor.SignalHealthy)

	// Fetch current guardian set
	timeout, _ = context.WithTimeout(ctx, 15 * time.Second)
	opts := &bind.CallOpts{Context: timeout}

	currentIndex, err := caller.GuardianSetIndex(opts)
	if err != nil {
		return fmt.Errorf("error requesting current guardian set index: %w", err)
	}

	gs, err := caller.GetGuardianSet(opts, currentIndex)
	if err != nil {
		return fmt.Errorf("error requesting current guardian set value: %w", err)
	}

	logger.Info("current guardian set fetched", zap.Any("value", gs), zap.Uint32("index", currentIndex))
	e.setChan <- &common.GuardianSet{
		Keys: gs.Keys,
		Index: currentIndex,
	}

	select {
	case <-ctx.Done():
		return ctx.Err()
	case err := <-errC:
		return err
	}
}
