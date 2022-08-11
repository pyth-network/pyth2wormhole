const jsonfile = require("jsonfile");
const elliptic = require("elliptic");
const BigNumber = require("bignumber.js");

const PythStructs = artifacts.require("PythStructs");

const { deployProxy, upgradeProxy } = require("@openzeppelin/truffle-upgrades");
const { expectRevert, expectEvent, time } = require("@openzeppelin/test-helpers");
const { assert } = require("chai");

// Use "WormholeReceiver" if you are testing with Wormhole Receiver
const Wormhole = artifacts.require("Wormhole");

const PythUpgradable = artifacts.require("PythUpgradable");
const MockPythUpgrade = artifacts.require("MockPythUpgrade");

const testSigner1PK =
    "cfb12303a19cde580bb4dd771639b0d26bc68353645571a8cff516ab2ee113a0";
const testSigner2PK =
    "892330666a850761e7370376430bb8c2aa1494072d3bfeaed0c4fa3d5a9135fe";

contract("Pyth", function () {
    const testSigner1 = web3.eth.accounts.privateKeyToAccount(testSigner1PK);
    const testSigner2 = web3.eth.accounts.privateKeyToAccount(testSigner2PK);
    const testGovernanceChainId = "3";
    const testGovernanceContract =
        "0x0000000000000000000000000000000000000000000000000000000000000004";
    const testPyth2WormholeChainId = "1";
    const testPyth2WormholeEmitter =
        "0x71f8dcb863d176e2c420ad6610cf687359612b6fb392e0642b0ca6b1f186aa3b";
    const notOwnerError =
        "Ownable: caller is not the owner -- Reason given: Ownable: caller is not the owner.";
    const insufficientFeeError = 
        "Insufficient paid fee amount";

    // Place all atomic operations that are done within migrations here.
    beforeEach(async function () {
        this.pythProxy = await deployProxy(PythUpgradable, [
            (await Wormhole.deployed()).address,
            testPyth2WormholeChainId,
            testPyth2WormholeEmitter,
        ]);

        await this.pythProxy.addDataSource(
            testPyth2WormholeChainId,
            testPyth2WormholeEmitter
        );

        // Setting the validity time to 10 seconds
        await this.pythProxy.updateValidTimePeriodSeconds(60);
    });

    it("should be initialized with the correct signers and values", async function () {
        await this.pythProxy.isValidDataSource(testPyth2WormholeChainId, testPyth2WormholeEmitter);
    });

    it("should allow upgrades from the owner", async function () {
        // Check that the owner is the default account Truffle
        // has configured for the network. upgradeProxy will send
        // transactions from the default account.
        const accounts = await web3.eth.getAccounts();
        const defaultAccount = accounts[0];
        const owner = await this.pythProxy.owner();
        assert.equal(owner, defaultAccount);

        // Try and upgrade the proxy
        const newImplementation = await upgradeProxy(
            this.pythProxy.address,
            MockPythUpgrade
        );

        // Check that the new upgrade is successful
        assert.equal(await newImplementation.isUpgradeActive(), true);
        assert.equal(this.pythProxy.address, newImplementation.address);
    });

    it("should allow ownership transfer", async function () {
        // Check that the owner is the default account Truffle
        // has configured for the network.
        const accounts = await web3.eth.getAccounts();
        const defaultAccount = accounts[0];
        assert.equal(await this.pythProxy.owner(), defaultAccount);

        // Check that another account can't transfer the ownership
        await expectRevert(
            this.pythProxy.transferOwnership(accounts[1], {
                from: accounts[1],
            }),
            notOwnerError
        );

        // Transfer the ownership to another account
        await this.pythProxy.transferOwnership(accounts[2], {
            from: defaultAccount,
        });
        assert.equal(await this.pythProxy.owner(), accounts[2]);

        // Check that the original account can't transfer the ownership back to itself
        await expectRevert(
            this.pythProxy.transferOwnership(defaultAccount, {
                from: defaultAccount,
            }),
            notOwnerError
        );

        // Check that the new owner can transfer the ownership back to the original account
        await this.pythProxy.transferOwnership(defaultAccount, {
            from: accounts[2],
        });
        assert.equal(await this.pythProxy.owner(), defaultAccount);
    });

    it("should not allow upgrades from the another account", async function () {
        // This test is slightly convoluted as, due to a limitation of Truffle,
        // we cannot specify which account upgradeProxy send transactions from:
        // it will always use the default account.
        //
        // Therefore, we transfer the ownership to another account first,
        // and then attempt an upgrade using the default account.

        // Check that the owner is the default account Truffle
        // has configured for the network.
        const accounts = await web3.eth.getAccounts();
        const defaultAccount = accounts[0];
        assert.equal(await this.pythProxy.owner(), defaultAccount);

        // Transfer the ownership to another account
        const newOwnerAccount = accounts[1];
        await this.pythProxy.transferOwnership(newOwnerAccount, {
            from: defaultAccount,
        });
        assert.equal(await this.pythProxy.owner(), newOwnerAccount);

        // Try and upgrade using the default account, which will fail
        // because we are no longer the owner.
        await expectRevert(
            upgradeProxy(this.pythProxy.address, MockPythUpgrade),
            notOwnerError
        );
    });

    it("should allow updating singleUpdateFeeInWei by owner", async function () {
        // Check that the owner is the default account Truffle
        // has configured for the network.
        const accounts = await web3.eth.getAccounts();
        const defaultAccount = accounts[0];
        assert.equal(await this.pythProxy.owner(), defaultAccount);

        // Check initial fee is zero
        assert.equal(await this.pythProxy.singleUpdateFeeInWei(), 0);

        // Set fee 
        await this.pythProxy.updateSingleUpdateFeeInWei(10);
        assert.equal(await this.pythProxy.singleUpdateFeeInWei(), 10);
    });

    it("should not allow updating singleUpdateFeeInWei by another account", async function () {
        // Check that the owner is the default account Truffle
        // has configured for the network.
        const accounts = await web3.eth.getAccounts();
        const defaultAccount = accounts[0];
        assert.equal(await this.pythProxy.owner(), defaultAccount);

        // Check initial valid time period is zero
        assert.equal(await this.pythProxy.singleUpdateFeeInWei(), 0);

        // Checks setting valid time period using another account reverts.
        await expectRevert(
            this.pythProxy.updateSingleUpdateFeeInWei(10, {from: accounts[1]}),
            notOwnerError,
        );
    });

    it("should allow updating validTimePeriodSeconds by owner", async function () {
        // Check that the owner is the default account Truffle
        // has configured for the network.
        const accounts = await web3.eth.getAccounts();
        const defaultAccount = accounts[0];
        assert.equal(await this.pythProxy.owner(), defaultAccount);

        // Check initial valid time period is zero
        assert.equal(await this.pythProxy.validTimePeriodSeconds(), 0);

        // Set valid time period 
        await this.pythProxy.updateValidTimePeriodSeconds(30);
        assert.equal(await this.pythProxy.validTimePeriodSeconds(), 30);
    });

    it("should not allow updating validTimePeriodSeconds by another account", async function () {
        // Check that the owner is the default account Truffle
        // has configured for the network.
        const accounts = await web3.eth.getAccounts();
        const defaultAccount = accounts[0];
        assert.equal(await this.pythProxy.owner(), defaultAccount);

        // Check initial fee is zero
        assert.equal(await this.pythProxy.validTimePeriodSeconds(), 0);

        // Checks setting fee using another account reverts.
        await expectRevert(
            this.pythProxy.updateValidTimePeriodSeconds(30, {from: accounts[1]}),
            notOwnerError,
        );
    });

    // NOTE(2022-05-02): Raw hex payload obtained from format serialization unit tests in `p2w-sdk/rust`
    // Latest known addition: wire format v3
    //
    // Tests rely on a p2w-sdk mock price/prod ID generation rule:
    // nthProdByte(n) = n % 256, starting with n=1
    // nthPriceByte(n) = 255 - (n % 256), starting with n=1
    //
    // Examples:
    // 1st prod = "0x010101[...]"
    // 1st price = "0xFEFEFE[...]"
    // 2nd prod = "0x020202[...]"
    // 2nd price = "0xFDFDFD[...]"
    // 3rd prod = "0x030303[...]"
    // 3rd price = "0xFCFCFC[...]"
    const RAW_BATCH_ATTESTATION_TIME_REGEX = /DEADBEEFFADEDEED/g;
    const RAW_BATCH_PUBLISH_TIME_REGEX = /00000000DADEBEEF/g;
    const RAW_BATCH_PRICE_REGEX = /0000002BAD2FEED7/g;
    const RAW_PRICE_ATTESTATION_SIZE = 149;
    const RAW_BATCH_ATTESTATION_COUNT = 10;
    const RAW_BATCH =
        "0x" +
        "5032574800030000000102000A00950101010101010101010101010101010101010101010101010101010101010101FEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFE0000002BAD2FEED70000000000000065FFFFFFFDFFFFFFFFFFFFFFD6000000000000002A010001E14C0004E6D0DEADBEEFFADEDEED00000000DADEBEEF00000000DEADBABE0000DEADFACEBEEF000000BADBADBEEF0202020202020202020202020202020202020202020202020202020202020202FDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFD0000002BAD2FEED70000000000000065FFFFFFFDFFFFFFFFFFFFFFD6000000000000002A010001E14C0004E6D0DEADBEEFFADEDEED00000000DADEBEEF00000000DEADBABE0000DEADFACEBEEF000000BADBADBEEF0303030303030303030303030303030303030303030303030303030303030303FCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFC0000002BAD2FEED70000000000000065FFFFFFFDFFFFFFFFFFFFFFD6000000000000002A010001E14C0004E6D0DEADBEEFFADEDEED00000000DADEBEEF00000000DEADBABE0000DEADFACEBEEF000000BADBADBEEF0404040404040404040404040404040404040404040404040404040404040404FBFBFBFBFBFBFBFBFBFBFBFBFBFBFBFBFBFBFBFBFBFBFBFBFBFBFBFBFBFBFBFB0000002BAD2FEED70000000000000065FFFFFFFDFFFFFFFFFFFFFFD6000000000000002A010001E14C0004E6D0DEADBEEFFADEDEED00000000DADEBEEF00000000DEADBABE0000DEADFACEBEEF000000BADBADBEEF0505050505050505050505050505050505050505050505050505050505050505FAFAFAFAFAFAFAFAFAFAFAFAFAFAFAFAFAFAFAFAFAFAFAFAFAFAFAFAFAFAFAFA0000002BAD2FEED70000000000000065FFFFFFFDFFFFFFFFFFFFFFD6000000000000002A010001E14C0004E6D0DEADBEEFFADEDEED00000000DADEBEEF00000000DEADBABE0000DEADFACEBEEF000000BADBADBEEF0606060606060606060606060606060606060606060606060606060606060606F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F90000002BAD2FEED70000000000000065FFFFFFFDFFFFFFFFFFFFFFD6000000000000002A010001E14C0004E6D0DEADBEEFFADEDEED00000000DADEBEEF00000000DEADBABE0000DEADFACEBEEF000000BADBADBEEF0707070707070707070707070707070707070707070707070707070707070707F8F8F8F8F8F8F8F8F8F8F8F8F8F8F8F8F8F8F8F8F8F8F8F8F8F8F8F8F8F8F8F80000002BAD2FEED70000000000000065FFFFFFFDFFFFFFFFFFFFFFD6000000000000002A010001E14C0004E6D0DEADBEEFFADEDEED00000000DADEBEEF00000000DEADBABE0000DEADFACEBEEF000000BADBADBEEF0808080808080808080808080808080808080808080808080808080808080808F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F70000002BAD2FEED70000000000000065FFFFFFFDFFFFFFFFFFFFFFD6000000000000002A010001E14C0004E6D0DEADBEEFFADEDEED00000000DADEBEEF00000000DEADBABE0000DEADFACEBEEF000000BADBADBEEF0909090909090909090909090909090909090909090909090909090909090909F6F6F6F6F6F6F6F6F6F6F6F6F6F6F6F6F6F6F6F6F6F6F6F6F6F6F6F6F6F6F6F60000002BAD2FEED70000000000000065FFFFFFFDFFFFFFFFFFFFFFD6000000000000002A010001E14C0004E6D0DEADBEEFFADEDEED00000000DADEBEEF00000000DEADBABE0000DEADFACEBEEF000000BADBADBEEF0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0AF5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F50000002BAD2FEED70000000000000065FFFFFFFDFFFFFFFFFFFFFFD6000000000000002A010001E14C0004E6D0DEADBEEFFADEDEED00000000DADEBEEF00000000DEADBABE0000DEADFACEBEEF000000BADBADBEEF";

    // Takes an unsigned 64-bit integer, converts it to hex with 0-padding
    function u64ToHex(timestamp) {
        // u64 -> 8 bytes -> 16 hex bytes
        return timestamp.toString(16).padStart(16, "0");
    }

    function generateRawBatchAttestation(
        publishTime,
        attestationTime,
        priceVal
    ) {
        const pubTs = u64ToHex(publishTime);
        const attTs = u64ToHex(attestationTime);
        const price = u64ToHex(priceVal);
        const replaced = RAW_BATCH.replace(RAW_BATCH_PUBLISH_TIME_REGEX, pubTs)
            .replace(RAW_BATCH_ATTESTATION_TIME_REGEX, attTs)
            .replace(RAW_BATCH_PRICE_REGEX, price);
        return replaced;
    }

    it("should parse batch price attestation correctly", async function () {
        const magic = 0x50325748;
        const versionMajor = 3;
        const versionMinor = 0;

        let attestationTime = 1647273460; // re-used for publishTime
        let publishTime = 1647273465; // re-used for publishTime
        let priceVal = 1337;
        let rawBatch = generateRawBatchAttestation(
            publishTime,
            attestationTime,
            priceVal
        );
        let parsed = await this.pythProxy.parseBatchPriceAttestation(rawBatch);

        // Check the header
        assert.equal(parsed.header.magic, magic);
        assert.equal(parsed.header.versionMajor, versionMajor);
        assert.equal(parsed.header.versionMinor, versionMinor);
        assert.equal(parsed.header.payloadId, 2);

        assert.equal(parsed.nAttestations, RAW_BATCH_ATTESTATION_COUNT);
        assert.equal(parsed.attestationSize, RAW_PRICE_ATTESTATION_SIZE);

        assert.equal(parsed.attestations.length, parsed.nAttestations);

        for (var i = 0; i < parsed.attestations.length; ++i) {
            const prodId =
                "0x" + (i + 1).toString(16).padStart(2, "0").repeat(32);
            const priceByte = 255 - ((i + 1) % 256);
            const priceId =
                "0x" + priceByte.toString(16).padStart(2, "0").repeat(32);

            assert.equal(parsed.attestations[i].productId, prodId);
            assert.equal(parsed.attestations[i].priceId, priceId);
            assert.equal(parsed.attestations[i].price, priceVal);
            assert.equal(parsed.attestations[i].conf, 101);
            assert.equal(parsed.attestations[i].expo, -3);
            assert.equal(parsed.attestations[i].emaPrice, -42);
            assert.equal(parsed.attestations[i].emaConf, 42);
            assert.equal(parsed.attestations[i].status, 1);
            assert.equal(parsed.attestations[i].numPublishers, 123212);
            assert.equal(parsed.attestations[i].maxNumPublishers, 321232);
            assert.equal(
                parsed.attestations[i].attestationTime,
                attestationTime
            );
            assert.equal(parsed.attestations[i].publishTime, publishTime);
            assert.equal(parsed.attestations[i].prevPublishTime, 0xdeadbabe);
            assert.equal(parsed.attestations[i].prevPrice, 0xdeadfacebeef);
            assert.equal(parsed.attestations[i].prevConf, 0xbadbadbeef);

            console.debug(
                `attestation ${i + 1}/${parsed.attestations.length} parsed OK`
            );
        }
    });

    async function updatePriceFeeds(contract, batches, valueInWei) {
        let updateData = [];
        for (let data of batches) {
            const vm = await signAndEncodeVM(
                1,
                1,
                testPyth2WormholeChainId,
                testPyth2WormholeEmitter,
                0,
                data,
                [testSigner1PK],
                0,
                0
            );
            updateData.push("0x" + vm);
        }
        return await contract.updatePriceFeeds(updateData, {value: valueInWei});
    }

    it("should attest price updates over wormhole", async function () {
        let ts = 1647273460;
        let rawBatch = generateRawBatchAttestation(ts - 5, ts, 1337);
        await updatePriceFeeds(this.pythProxy, [rawBatch]);
    });

    it("should attest price updates empty", async function () {
        const receipt = await updatePriceFeeds(this.pythProxy, []);
        expectEvent.notEmitted(receipt, 'PriceFeedUpdate');
        expectEvent.notEmitted(receipt, 'BatchPriceFeedUpdate');
        expectEvent(receipt, 'UpdatePriceFeeds', {
            batchCount: '0',
        });
    });

    it("should attest price updates with multiple batches of correct order", async function () {
        let ts = 1647273460;
        let rawBatch1 = generateRawBatchAttestation(ts - 5, ts, 1337);
        let rawBatch2 = generateRawBatchAttestation(ts + 5, ts + 10, 1338);
        const receipt = await updatePriceFeeds(this.pythProxy, [rawBatch1, rawBatch2]);
        expectEvent(receipt, 'PriceFeedUpdate', {
            fresh: true,
        });
        expectEvent(receipt, 'BatchPriceFeedUpdate', {
            batchSize: '10',
            freshPricesInBatch: '10',
        });
        expectEvent(receipt, 'UpdatePriceFeeds', {
            batchCount: '2',
        });
    });

    it("should attest price updates with multiple batches of wrong order", async function () {
        let ts = 1647273460;
        let rawBatch1 = generateRawBatchAttestation(ts - 5, ts, 1337);
        let rawBatch2 = generateRawBatchAttestation(ts + 5, ts + 10, 1338);
        const receipt = await updatePriceFeeds(this.pythProxy, [rawBatch2, rawBatch1]);
        expectEvent(receipt, 'PriceFeedUpdate', {
            fresh: true,
        });
        expectEvent(receipt, 'PriceFeedUpdate', {
            fresh: false,
        });
        expectEvent(receipt, 'BatchPriceFeedUpdate', {
            batchSize: '10',
            freshPricesInBatch: '10',
        });
        expectEvent(receipt, 'BatchPriceFeedUpdate', {
            batchSize: '10',
            freshPricesInBatch: '0',
        });
        expectEvent(receipt, 'UpdatePriceFeeds', {
            batchCount: '2',
        });
    });

    it("should not attest price updates with when required fee is not given", async function () {
        // Check that the owner is the default account Truffle
        // has configured for the network.
        const accounts = await web3.eth.getAccounts();
        const defaultAccount = accounts[0];
        assert.equal(await this.pythProxy.owner(), defaultAccount);

        // Check initial fee is zero
        assert.equal(await this.pythProxy.singleUpdateFeeInWei(), 0);

        // Set fee 
        await this.pythProxy.updateSingleUpdateFeeInWei(10);
        assert.equal(await this.pythProxy.singleUpdateFeeInWei(), 10);

        let ts = 1647273460;
        let rawBatch1 = generateRawBatchAttestation(ts - 5, ts, 1337);
        let rawBatch2 = generateRawBatchAttestation(ts + 5, ts + 10, 1338);

        // Getting the fee from the contract
        let feeInWei = await this.pythProxy.getUpdateFee(2);
        assert.equal(feeInWei, 20);

        // When a smaller fee is payed it reverts
        await expectRevert(
            updatePriceFeeds(this.pythProxy, [rawBatch1, rawBatch2], feeInWei - 1), 
            insufficientFeeError
        );
    });

    it("should attest price updates with when required fee is given", async function () {
        // Check that the owner is the default account Truffle
        // has configured for the network.
        const accounts = await web3.eth.getAccounts();
        const defaultAccount = accounts[0];
        assert.equal(await this.pythProxy.owner(), defaultAccount);

        // Check initial fee is zero
        assert.equal(await this.pythProxy.singleUpdateFeeInWei(), 0);

        // Set fee 
        await this.pythProxy.updateSingleUpdateFeeInWei(10);
        assert.equal(await this.pythProxy.singleUpdateFeeInWei(), 10);

        let ts = 1647273460;
        let rawBatch1 = generateRawBatchAttestation(ts - 5, ts, 1337);
        let rawBatch2 = generateRawBatchAttestation(ts + 5, ts + 10, 1338);

        // Getting the fee from the contract
        let feeInWei = await this.pythProxy.getUpdateFee(2);
        assert.equal(feeInWei, 20);

        const receipt = await updatePriceFeeds(this.pythProxy, [rawBatch1, rawBatch2], feeInWei);
        expectEvent(receipt, 'UpdatePriceFeeds', {
            fee: feeInWei
        });
        const pythBalance = await web3.eth.getBalance(this.pythProxy.address);
        assert.equal(pythBalance, feeInWei);
    });

    it("should attest price updates with required fee even if more fee is given", async function () {
        // Check that the owner is the default account Truffle
        // has configured for the network.
        const accounts = await web3.eth.getAccounts();
        const defaultAccount = accounts[0];
        assert.equal(await this.pythProxy.owner(), defaultAccount);

        // Check initial fee is zero
        assert.equal(await this.pythProxy.singleUpdateFeeInWei(), 0);

        // Set fee 
        await this.pythProxy.updateSingleUpdateFeeInWei(10);
        assert.equal(await this.pythProxy.singleUpdateFeeInWei(), 10);

        let ts = 1647273460;
        let rawBatch1 = generateRawBatchAttestation(ts - 5, ts, 1337);
        let rawBatch2 = generateRawBatchAttestation(ts + 5, ts + 10, 1338);

        // Getting the fee from the contract
        let feeInWei = await this.pythProxy.getUpdateFee(2);
        assert.equal(feeInWei, 20);

        const receipt = await updatePriceFeeds(this.pythProxy, [rawBatch1, rawBatch2], feeInWei + 10);
        expectEvent(receipt, 'UpdatePriceFeeds', {
            fee: feeInWei
        });
        const pythBalance = await web3.eth.getBalance(this.pythProxy.address);
        assert.equal(pythBalance, feeInWei);
    });

    it("should cache price updates", async function () {
        let currentTimestamp = (await web3.eth.getBlock("latest")).timestamp;
        let priceVal = 521;
        let rawBatch = generateRawBatchAttestation(
            currentTimestamp - 5,
            currentTimestamp,
            priceVal
        );
        let receipt = await updatePriceFeeds(this.pythProxy, [rawBatch]);
        expectEvent(receipt, 'PriceFeedUpdate', {
            fresh: true,
        });
        expectEvent(receipt, 'BatchPriceFeedUpdate', {
            batchSize: '10',
            freshPricesInBatch: '10',
        });
        expectEvent(receipt, 'UpdatePriceFeeds', {
            batchCount: '1',
        });

        let first_prod_id = "0x" + "01".repeat(32);
        let first_price_id = "0x" + "fe".repeat(32);
        let second_prod_id = "0x" + "02".repeat(32);
        let second_price_id = "0x" + "fd".repeat(32);

        // Confirm that previously non-existent feeds are created
        let first = await this.pythProxy.queryPriceFeed(first_price_id);
        console.debug(`first is ${JSON.stringify(first)}`);
        assert.equal(first.price, priceVal);

        let second = await this.pythProxy.queryPriceFeed(second_price_id);
        assert.equal(second.price, priceVal);

        // Confirm the price is bumped after a new attestation updates each record
        let nextTimestamp = currentTimestamp + 1;
        let rawBatch2 = generateRawBatchAttestation(
            nextTimestamp - 5,
            nextTimestamp,
            priceVal + 5
        );
        receipt = await updatePriceFeeds(this.pythProxy, [rawBatch2]);
        expectEvent(receipt, 'PriceFeedUpdate', {
            fresh: true,
        });
        expectEvent(receipt, 'BatchPriceFeedUpdate', {
            batchSize: '10',
            freshPricesInBatch: '10',
        });
        expectEvent(receipt, 'UpdatePriceFeeds', {
            batchCount: '1',
        });

        first = await this.pythProxy.queryPriceFeed(first_price_id);
        assert.equal(first.price, priceVal + 5);

        second = await this.pythProxy.queryPriceFeed(second_price_id);
        assert.equal(second.price, priceVal + 5);

        // Confirm that only strictly larger timestamps trigger updates
        let rawBatch3 = generateRawBatchAttestation(
            nextTimestamp - 5,
            nextTimestamp,
            priceVal + 10
        );
        receipt = await updatePriceFeeds(this.pythProxy, [rawBatch3]);
        expectEvent(receipt, 'PriceFeedUpdate', {
            fresh: false,
        });
        expectEvent(receipt, 'BatchPriceFeedUpdate', {
            batchSize: '10',
            freshPricesInBatch: '0',
        });
        expectEvent(receipt, 'UpdatePriceFeeds', {
            batchCount: '1',
        });

        first = await this.pythProxy.queryPriceFeed(first_price_id);
        assert.equal(first.price, priceVal + 5);
        assert.notEqual(first.price, priceVal + 10);

        second = await this.pythProxy.queryPriceFeed(second_price_id);
        assert.equal(second.price, priceVal + 5);
        assert.notEqual(second.price, priceVal + 10);
    });

    it("should fail transaction if a price is not found", async function () {
        await expectRevert(
            this.pythProxy.queryPriceFeed(
                "0xdeadfeeddeadfeeddeadfeeddeadfeeddeadfeeddeadfeeddeadfeeddeadfeed"
            ),
            "no price feed found for the given price id"
        );
    });

    it("should show stale cached prices as unknown", async function () {
        let smallestTimestamp = 1;
        let rawBatch = generateRawBatchAttestation(
            smallestTimestamp,
            smallestTimestamp + 5,
            1337
        );
        await updatePriceFeeds(this.pythProxy, [rawBatch]);

        for (var i = 1; i <= RAW_BATCH_ATTESTATION_COUNT; i++) {
            const price_id =
                "0x" +
                (255 - (i % 256)).toString(16).padStart(2, "0").repeat(32);
            let priceFeedResult = await this.pythProxy.queryPriceFeed(price_id);
            assert.equal(
                priceFeedResult.status.toString(),
                PythStructs.PriceStatus.UNKNOWN.toString()
            );
        }
    });

    it("should show cached prices too far into the future as unknown", async function () {
        let largestTimestamp = 4294967295;
        let rawBatch = generateRawBatchAttestation(
            largestTimestamp - 5,
            largestTimestamp,
            1337
        );
        await updatePriceFeeds(this.pythProxy, [rawBatch]);

        for (var i = 1; i <= RAW_BATCH_ATTESTATION_COUNT; i++) {
            const price_id =
                "0x" +
                (255 - (i % 256)).toString(16).padStart(2, "0").repeat(32);
            let priceFeedResult = await this.pythProxy.queryPriceFeed(price_id);
            assert.equal(
                priceFeedResult.status.toString(),
                PythStructs.PriceStatus.UNKNOWN.toString()
            );
        }
    });

    it("changing validity time works", async function() {
        const latestTime = await time.latest();
        let rawBatch = generateRawBatchAttestation(
            latestTime,
            latestTime,
            1337
        );

        await updatePriceFeeds(this.pythProxy, [rawBatch]);

        // Setting the validity time to 30 seconds
        await this.pythProxy.updateValidTimePeriodSeconds(30);

        // Then prices should be available
        for (var i = 1; i <= RAW_BATCH_ATTESTATION_COUNT; i++) {
            const price_id =
                "0x" +
                (255 - (i % 256)).toString(16).padStart(2, "0").repeat(32);
            let priceFeedResult = await this.pythProxy.queryPriceFeed(price_id);
            assert.equal(
                priceFeedResult.status.toString(),
                PythStructs.PriceStatus.TRADING.toString()
            );
        }

        // One minute passes
        await time.increase(time.duration.minutes(1));

        // The prices should become unavailable now.
        for (var i = 1; i <= RAW_BATCH_ATTESTATION_COUNT; i++) {
            const price_id =
                "0x" +
                (255 - (i % 256)).toString(16).padStart(2, "0").repeat(32);
            let priceFeedResult = await this.pythProxy.queryPriceFeed(price_id);
            assert.equal(
                priceFeedResult.status.toString(),
                PythStructs.PriceStatus.UNKNOWN.toString()
            );
        }

        // Setting the validity time to 120 seconds
        await this.pythProxy.updateValidTimePeriodSeconds(120);

        // Then prices should be available because the valid period is now 120 seconds
        for (var i = 1; i <= RAW_BATCH_ATTESTATION_COUNT; i++) {
            const price_id =
                "0x" +
                (255 - (i % 256)).toString(16).padStart(2, "0").repeat(32);
            let priceFeedResult = await this.pythProxy.queryPriceFeed(price_id);
            assert.equal(
                priceFeedResult.status.toString(),
                PythStructs.PriceStatus.TRADING.toString()
            );
        }
    });

    it("should accept a VM after adding its data source", async function () {
        let newChainId = "42424";
        let newEmitter = testPyth2WormholeEmitter.replace("a", "f");

        await this.pythProxy.addDataSource(newChainId, newEmitter);

        let currentTimestamp = (await web3.eth.getBlock("latest")).timestamp;
        let rawBatch = generateRawBatchAttestation(
            currentTimestamp - 5,
            currentTimestamp,
            1337
        );
        let vm = await signAndEncodeVM(
            1,
            1,
            newChainId,
            newEmitter,
            0,
            rawBatch,
            [testSigner1PK],
            0,
            0
        );

        await this.pythProxy.updatePriceFeeds(["0x" + vm]);
    });

    it("should reject a VM after removing its data source", async function () {
        // Add 2 new data sources to produce a non-trivial data source state.
        let newChainId = "42424";
        let newEmitter = testPyth2WormholeEmitter.replace("a", "f");
        await this.pythProxy.addDataSource(newChainId, newEmitter);

        let newChainId2 = "42425";
        let newEmitter2 = testPyth2WormholeEmitter.replace("a", "e");
        await this.pythProxy.addDataSource(newChainId2, newEmitter2);

        // Remove the first one added
        await this.pythProxy.removeDataSource(newChainId, newEmitter);

        // Sign a batch with the removed data source
        let currentTimestamp = (await web3.eth.getBlock("latest")).timestamp;
        let rawBatch = generateRawBatchAttestation(
            currentTimestamp - 5,
            currentTimestamp,
            1337
        );
        let vm = await signAndEncodeVM(
            1,
            1,
            newChainId,
            newEmitter,
            0,
            rawBatch,
            [testSigner1PK],
            0,
            0
        );

        await expectRevert(
            this.pythProxy.updatePriceFeeds(["0x" + vm]),
            "invalid data source chain/emitter ID"
        );
    });
});

const signAndEncodeVM = async function (
    timestamp,
    nonce,
    emitterChainId,
    emitterAddress,
    sequence,
    data,
    signers,
    guardianSetIndex,
    consistencyLevel
) {
    const body = [
        web3.eth.abi
            .encodeParameter("uint32", timestamp)
            .substring(2 + (64 - 8)),
        web3.eth.abi.encodeParameter("uint32", nonce).substring(2 + (64 - 8)),
        web3.eth.abi
            .encodeParameter("uint16", emitterChainId)
            .substring(2 + (64 - 4)),
        web3.eth.abi.encodeParameter("bytes32", emitterAddress).substring(2),
        web3.eth.abi
            .encodeParameter("uint64", sequence)
            .substring(2 + (64 - 16)),
        web3.eth.abi
            .encodeParameter("uint8", consistencyLevel)
            .substring(2 + (64 - 2)),
        data.substr(2),
    ];

    const hash = web3.utils.soliditySha3(
        web3.utils.soliditySha3("0x" + body.join(""))
    );

    let signatures = "";

    for (let i in signers) {
        const ec = new elliptic.ec("secp256k1");
        const key = ec.keyFromPrivate(signers[i]);
        const signature = key.sign(hash.substr(2), { canonical: true });

        const packSig = [
            web3.eth.abi.encodeParameter("uint8", i).substring(2 + (64 - 2)),
            zeroPadBytes(signature.r.toString(16), 32),
            zeroPadBytes(signature.s.toString(16), 32),
            web3.eth.abi
                .encodeParameter("uint8", signature.recoveryParam)
                .substr(2 + (64 - 2)),
        ];

        signatures += packSig.join("");
    }

    const vm = [
        web3.eth.abi.encodeParameter("uint8", 1).substring(2 + (64 - 2)),
        web3.eth.abi
            .encodeParameter("uint32", guardianSetIndex)
            .substring(2 + (64 - 8)),
        web3.eth.abi
            .encodeParameter("uint8", signers.length)
            .substring(2 + (64 - 2)),

        signatures,
        body.join(""),
    ].join("");

    return vm;
};

function zeroPadBytes(value, length) {
    while (value.length < 2 * length) {
        value = "0" + value;
    }
    return value;
}
