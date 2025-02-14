module pyth_lazer::pyth_lazer {
    use std::vector;
    use aptos_framework::account;
    use aptos_framework::timestamp;
    use aptos_framework::coin::{Self, AptosCoin};
    use aptos_framework::ed25519;
    
    /// Error codes
    const ENO_PERMISSIONS: u64 = 1;
    const EINVALID_SIGNER: u64 = 2;
    const ENO_SPACE: u64 = 3;
    const ENO_SUCH_PUBKEY: u64 = 4;
    const EINVALID_SIGNATURE: u64 = 5;
    const EINSUFFICIENT_FEE: u64 = 6;

    /// Constants
    const MAX_NUM_TRUSTED_SIGNERS: u8 = 2;
    const ED25519_PUBLIC_KEY_LENGTH: u64 = 32;

    /// Stores information about a trusted signer including their public key and expiration
    struct TrustedSignerInfo has store, drop {
        pubkey: vector<u8>,  // Ed25519 public key (32 bytes)
        expires_at: u64,     // Unix timestamp
    }

    /// Main storage for the Lazer contract
    struct Storage has key {
        top_authority: address,
        treasury: address,
        single_update_fee: u64,  // Fee in Aptos native token (1 wei)
        num_trusted_signers: u8,
        trusted_signers: vector<TrustedSignerInfo>,
    }

    /// Events
    struct TrustedSignerUpdateEvent has drop, store {
        pubkey: vector<u8>,
        expires_at: u64,
    }

    /// Initialize the Lazer contract with top authority and treasury
    public entry fun initialize(
        account: &signer,
        top_authority: address,
        treasury: address,
    ) {
        let storage = Storage {
            top_authority,
            treasury,
            single_update_fee: 1, // 1 wei in Aptos native token
            num_trusted_signers: 0,
            trusted_signers: vector::empty(),
        };
        move_to(account, storage);
    }

    /// Update a trusted signer's information or remove them
    public entry fun update_trusted_signer(
        account: &signer,
        trusted_signer: vector<u8>,
        expires_at: u64,
    ) acquires Storage {
        let storage = borrow_global_mut<Storage>(account::get_signer_capability_address(account));
        assert!(account::get_signer_capability_address(account) == storage.top_authority, ENO_PERMISSIONS);
        assert!(vector::length(&trusted_signer) == ED25519_PUBLIC_KEY_LENGTH, EINVALID_SIGNER);

        let num_signers = storage.num_trusted_signers;
        let i = 0;
        let found = false;
        
        while (i < num_signers) {
            let signer_info = vector::borrow(&storage.trusted_signers, (i as u64));
            if (signer_info.pubkey == trusted_signer) {
                found = true;
                break
            };
            i = i + 1;
        };

        if (expires_at == 0) {
            // Remove signer
            assert!(found, ENO_SUCH_PUBKEY);
            vector::remove(&mut storage.trusted_signers, (i as u64));
            storage.num_trusted_signers = storage.num_trusted_signers - 1;
        } else if (found) {
            // Update existing signer
            let signer_info = vector::borrow_mut(&mut storage.trusted_signers, (i as u64));
            signer_info.expires_at = expires_at;
        } else {
            // Add new signer
            assert!(storage.num_trusted_signers < MAX_NUM_TRUSTED_SIGNERS, ENO_SPACE);
            vector::push_back(&mut storage.trusted_signers, TrustedSignerInfo {
                pubkey: trusted_signer,
                expires_at,
            });
            storage.num_trusted_signers = storage.num_trusted_signers + 1;
        };
    }

    /// Verify a message signature and collect fee
    public entry fun verify_message(
        account: &signer,
        message: vector<u8>,
        signature: vector<u8>,
        public_key: vector<u8>,
    ) acquires Storage {
        let storage = borrow_global<Storage>(account::get_signer_capability_address(account));
        
        // Verify fee payment
        assert!(aptos_framework::coin::balance<AptosCoin>(account::get_signer_capability_address(account)) >= storage.single_update_fee, EINSUFFICIENT_FEE);
        aptos_framework::coin::transfer<AptosCoin>(account, storage.treasury, storage.single_update_fee);

        // Verify signature
        assert!(ed25519::verify_signature(&public_key, &message, &signature), EINVALID_SIGNATURE);

        // Verify signer is trusted and not expired
        let i = 0;
        let valid = false;
        while (i < storage.num_trusted_signers) {
            let signer_info = vector::borrow(&storage.trusted_signers, (i as u64));
            if (signer_info.pubkey == public_key && signer_info.expires_at > timestamp::now_seconds()) {
                valid = true;
                break
            };
            i = i + 1;
        };
        assert!(valid, EINVALID_SIGNER);
    }
}
