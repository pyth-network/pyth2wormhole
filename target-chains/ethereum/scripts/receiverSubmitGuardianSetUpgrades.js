// run this script with truffle exec

const jsonfile = require("jsonfile");
const WormholeReceiver = artifacts.require("WormholeReceiver");
const WormholeReceiverImplementationFullABI = jsonfile.readFileSync(
  "../build/contracts/ReceiverImplementation.json"
).abi;

const GUARDIAN_SET_UPGRADE_1_VAA =
  "010000000001007ac31b282c2aeeeb37f3385ee0de5f8e421d30b9e5ae8ba3d4375c1c77a86e77159bb697d9c456d6f8c02d22a94b1279b65b0d6a9957e7d3857423845ac758e300610ac1d2000000030001000000000000000000000000000000000000000000000000000000000000000400000000000005390000000000000000000000000000000000000000000000000000000000436f7265020000000000011358cc3ae5c097b213ce3c81979e1b9f9570746aa5ff6cb952589bde862c25ef4392132fb9d4a42157114de8460193bdf3a2fcf81f86a09765f4762fd1107a0086b32d7a0977926a205131d8731d39cbeb8c82b2fd82faed2711d59af0f2499d16e726f6b211b39756c042441be6d8650b69b54ebe715e234354ce5b4d348fb74b958e8966e2ec3dbd4958a7cdeb5f7389fa26941519f0863349c223b73a6ddee774a3bf913953d695260d88bc1aa25a4eee363ef0000ac0076727b35fbea2dac28fee5ccb0fea768eaf45ced136b9d9e24903464ae889f5c8a723fc14f93124b7c738843cbb89e864c862c38cddcccf95d2cc37a4dc036a8d232b48f62cdd4731412f4890da798f6896a3331f64b48c12d1d57fd9cbe7081171aa1be1d36cafe3867910f99c09e347899c19c38192b6e7387ccd768277c17dab1b7a5027c0b3cf178e21ad2e77ae06711549cfbb1f9c7a9d8096e85e1487f35515d02a92753504a8d75471b9f49edb6fbebc898f403e4773e95feb15e80c9a99c8348d";
const GUARDIAN_SET_UPGRADE_2_VAA =
  "01000000010d0012e6b39c6da90c5dfd3c228edbb78c7a4c97c488ff8a346d161a91db067e51d638c17216f368aa9bdf4836b8645a98018ca67d2fec87d769cabfdf2406bf790a0002ef42b288091a670ef3556596f4f47323717882881eaf38e03345078d07a156f312b785b64dae6e9a87e3d32872f59cb1931f728cecf511762981baf48303668f0103cef2616b84c4e511ff03329e0853f1bd7ee9ac5ba71d70a4d76108bddf94f69c2a8a84e4ee94065e8003c334e899184943634e12043d0dda78d93996da073d190104e76d166b9dac98f602107cc4b44ac82868faf00b63df7d24f177aa391e050902413b71046434e67c770b19aecdf7fce1d1435ea0be7262e3e4c18f50ddc8175c0105d9450e8216d741e0206a50f93b750a47e0a258b80eb8fed1314cc300b3d905092de25cd36d366097b7103ae2d184121329ba3aa2d7c6cc53273f11af14798110010687477c8deec89d36a23e7948feb074df95362fc8dcbd8ae910ac556a1dee1e755c56b9db5d710c940938ed79bc1895a3646523a58bc55f475a23435a373ecfdd0107fb06734864f79def4e192497362513171530daea81f07fbb9f698afe7e66c6d44db21323144f2657d4a5386a954bb94eef9f64148c33aef6e477eafa2c5c984c01088769e82216310d1827d9bd48645ec23e90de4ef8a8de99e2d351d1df318608566248d80cdc83bdcac382b3c30c670352be87f9069aab5037d0b747208eae9c650109e9796497ff9106d0d1c62e184d83716282870cef61a1ee13d6fc485b521adcce255c96f7d1bca8d8e7e7d454b65783a830bddc9d94092091a268d311ecd84c26010c468c9fb6d41026841ff9f8d7368fa309d4dbea3ea4bbd2feccf94a92cc8a20a226338a8e2126cd16f70eaf15b4fc9be2c3fa19def14e071956a605e9d1ac4162010e23fcb6bd445b7c25afb722250c1acbc061ed964ba9de1326609ae012acdfb96942b2a102a2de99ab96327859a34a2b49a767dbdb62e0a1fb26af60fe44fd496a00106bb0bac77ac68b347645f2fb1ad789ea9bd76fb9b2324f25ae06f97e65246f142df717f662e73948317182c62ce87d79c73def0dba12e5242dfc038382812cfe00126da03c5e56cb15aeeceadc1e17a45753ab4dc0ec7bf6a75ca03143ed4a294f6f61bc3f478a457833e43084ecd7c985bf2f55a55f168aac0e030fc49e845e497101626e9d9a5d9e343f00010000000000000000000000000000000000000000000000000000000000000004c1759167c43f501c2000000000000000000000000000000000000000000000000000000000436f7265020000000000021358cc3ae5c097b213ce3c81979e1b9f9570746aa5ff6cb952589bde862c25ef4392132fb9d4a42157114de8460193bdf3a2fcf81f86a09765f4762fd1107a0086b32d7a0977926a205131d8731d39cbeb8c82b2fd82faed2711d59af0f2499d16e726f6b211b39756c042441be6d8650b69b54ebe715e234354ce5b4d348fb74b958e8966e2ec3dbd4958a7cd66b9590e1c41e0b226937bf9217d1d67fd4e91f574a3bf913953d695260d88bc1aa25a4eee363ef0000ac0076727b35fbea2dac28fee5ccb0fea768eaf45ced136b9d9e24903464ae889f5c8a723fc14f93124b7c738843cbb89e864c862c38cddcccf95d2cc37a4dc036a8d232b48f62cdd4731412f4890da798f6896a3331f64b48c12d1d57fd9cbe7081171aa1be1d36cafe3867910f99c09e347899c19c38192b6e7387ccd768277c17dab1b7a5027c0b3cf178e21ad2e77ae06711549cfbb1f9c7a9d8096e85e1487f35515d02a92753504a8d75471b9f49edb6fbebc898f403e4773e95feb15e80c9a99c8348d";
// const TEST_VAA =
//   "01000000020d005f7c6d5d57806e39e2b72f1b35e105b560dcbaa53ca159713897f666bbcca9566a3153bec04131423d31b3c612b0036711a8f3e092d382ee33666310ce9c13f00001f2bb445b90ce41374692d79037ae2fc76d45de890328404ccde3137a244774ca23cc0f74a3b4e89739cdc78a21e7605ec7f2e082e849d74ea284729916e430f40102fac6f17962e6225becdc69d4f3dbef29f7eda52cf189c3cbdec4d1fad98ba63e05aa8d446bd348fbf3dfeeb1753f857421f4d9b47f10a5eccb8927a289fa2e200103a5f7768647a609d20aaf90e09370f7261e2055b6eaded0941d8222a01d2618c11ef5912d8c00f571dd63157579a8ab39584186d5c6995d70ca255ee97d3f9b390104d529bd9ae735d480822cc094cbc74fe66010d233d81bf84278f0b439bc98df956361dd85b8a8ccb2f55bf94606ffb1dfc2260499c25c1027f51a5f7e7d4240ba010584ba8ebace2a0f39e4ca01c0d3f5b8686d18652cc0cd0f6516ce20ded88c796e002231f1198b7501839eb7fe442db09745d34d58c8a8f107a34dc50e19312eea0106744ce85d12622933bb7ffececee1d7eb27a1460f8a2062c2b39fe1524baebe9d2c543cdb9a762ef233fb3fe874f810ae0457ed1be3b087096d377feab781c44e010c972bab8988fb8df3864f0946771ad80affe3d46a9fc8a1ac5377cb14137fb9ec4e6f61e0deffe103cb090dde734edd72885c84023b2ed10d81a1edddfb13d9f7000db6bfe9f7a0a0c9088b9fc5ead7520af1e22dc58034e46d6a90e75a3dc4f9eb4026940bc9b0ce421cf1b3ea61f5e1863b7075e0c0baeeb9bc5793173e9777f6ac000e452480aa2500b30bd3dbc87f3f9f78b6b0c221ec0343db3bbc22833798ff1d8a480dbc9ae10960623c29373d0ac48f42ec33de03c935019f5fc73bc02b95b7b2010f252ddc2ffaecf009f77ce9e57844211723f13b2300c5791114a319943b3ed6c23f54f121061347973a0b23a8a40e8351a7ce848bd0d24581a1d763032e70062e001090ee9b3e84ea1eac58c043a683aa3c1e8b47a94bda3c1db4109e8d92e3f0f2f50562ef7cca4a90008970ec1e0975c9cefc5bd506d823c0d5f2bad70fb582bd9f011110515f473681be0b8457a9c930736520c62687c393f9f12ddc5daa858951ffee5b569a863561d85e5d76f3b0d0c7febdba8272563383ef2fb48cd23c2a856287006279c15f708b000000050000000000000000000000005a58505a96d1dbf8df91cb21b54419fc36e93fde000000000000aff20f010000000000000000000000000000000000000000000000000000000a6830e3a20000000000000000000000000d500b1d8e8ef31e21c99d1db9a6444d3adf1270000500000000000000000000000031adfc3e96825ecb4e6a6bc09349b4a1a9080c1300060000000000000000000000000000000000000000000000000000000000000000";
const GUARDIAN_SET_UPGRADE_3_VAA =
  "01000000020d00ce45474d9e1b1e7790a2d210871e195db53a70ffd6f237cfe70e2686a32859ac43c84a332267a8ef66f59719cf91cc8df0101fd7c36aa1878d5139241660edc0010375cc906156ae530786661c0cd9aef444747bc3d8d5aa84cac6a6d2933d4e1a031cffa30383d4af8131e929d9f203f460b07309a647d6cd32ab1cc7724089392c000452305156cfc90343128f97e499311b5cae174f488ff22fbc09591991a0a73d8e6af3afb8a5968441d3ab8437836407481739e9850ad5c95e6acfcc871e951bc30105a7956eefc23e7c945a1966d5ddbe9e4be376c2f54e45e3d5da88c2f8692510c7429b1ea860ae94d929bd97e84923a18187e777aa3db419813a80deb84cc8d22b00061b2a4f3d2666608e0aa96737689e3ba5793810ff3a52ff28ad57d8efb20967735dc5537a2e43ef10f583d144c12a1606542c207f5b79af08c38656d3ac40713301086b62c8e130af3411b3c0d91b5b50dcb01ed5f293963f901fc36e7b0e50114dce203373b32eb45971cef8288e5d928d0ed51cd86e2a3006b0af6a65c396c009080009e93ab4d2c8228901a5f4525934000b2c26d1dc679a05e47fdf0ff3231d98fbc207103159ff4116df2832eea69b38275283434e6cd4a4af04d25fa7a82990b707010aa643f4cf615dfff06ffd65830f7f6cf6512dabc3690d5d9e210fdc712842dc2708b8b2c22e224c99280cd25e5e8bfb40e3d1c55b8c41774e287c1e2c352aecfc010b89c1e85faa20a30601964ccc6a79c0ae53cfd26fb10863db37783428cd91390a163346558239db3cd9d420cfe423a0df84c84399790e2e308011b4b63e6b8015010ca31dcb564ac81a053a268d8090e72097f94f366711d0c5d13815af1ec7d47e662e2d1bde22678113d15963da100b668ba26c0c325970d07114b83c5698f46097010dc9fda39c0d592d9ed92cd22b5425cc6b37430e236f02d0d1f8a2ef45a00bde26223c0a6eb363c8b25fd3bf57234a1d9364976cefb8360e755a267cbbb674b39501108db01e444ab1003dd8b6c96f8eb77958b40ba7a85fefecf32ad00b7a47c0ae7524216262495977e09c0989dd50f280c21453d3756843608eacd17f4fdfe47600001261025228ef5af837cb060bcd986fcfa84ccef75b3fa100468cfd24e7fadf99163938f3b841a33496c2706d0208faab088bd155b2e20fd74c625bb1cc8c43677a0163c53c409e0c5dfa000100000000000000000000000000000000000000000000000000000000000000046c5a054d7833d1e42000000000000000000000000000000000000000000000000000000000436f7265020000000000031358cc3ae5c097b213ce3c81979e1b9f9570746aa5ff6cb952589bde862c25ef4392132fb9d4a42157114de8460193bdf3a2fcf81f86a09765f4762fd1107a0086b32d7a0977926a205131d8731d39cbeb8c82b2fd82faed2711d59af0f2499d16e726f6b211b39756c042441be6d8650b69b54ebe715e234354ce5b4d348fb74b958e8966e2ec3dbd4958a7cd15e7caf07c4e3dc8e7c469f92c8cd88fb8005a2074a3bf913953d695260d88bc1aa25a4eee363ef0000ac0076727b35fbea2dac28fee5ccb0fea768eaf45ced136b9d9e24903464ae889f5c8a723fc14f93124b7c738843cbb89e864c862c38cddcccf95d2cc37a4dc036a8d232b48f62cdd4731412f4890da798f6896a3331f64b48c12d1d57fd9cbe7081171aa1be1d36cafe3867910f99c09e347899c19c38192b6e7387ccd768277c17dab1b7a5027c0b3cf178e21ad2e77ae06711549cfbb1f9c7a9d8096e85e1487f35515d02a92753504a8d75471b9f49edb6fbebc898f403e4773e95feb15e80c9a99c8348d";

module.exports = async function (callback) {
  try {
    const accounts = await web3.eth.getAccounts();
    const initialized = new web3.eth.Contract(
      WormholeReceiverImplementationFullABI,
      WormholeReceiver.address
    );
    // Upgrade set 0 to set 1
    await initialized.methods
      .submitNewGuardianSet("0x" + GUARDIAN_SET_UPGRADE_1_VAA)
      .send({
        value: 0,
        from: accounts[0],
        gasLimit: 2000000,
      });
    // Upgrade set 1 to set 2
    await initialized.methods
      .submitNewGuardianSet("0x" + GUARDIAN_SET_UPGRADE_2_VAA)
      .send({
        value: 0,
        from: accounts[0],
        gasLimit: 2000000,
      });
    // Upgrade set 2 to set 3
    await initialized.methods
    .submitNewGuardianSet("0x" + GUARDIAN_SET_UPGRADE_3_VAA)
    .send({
      value: 0,
      from: accounts[0],
      gasLimit: 2000000,
    });
    // console.log(
    //   await initialized.methods.parseAndVerifyVM("0x" + TEST_VAA).call()
    // );
    console.log("Updated the guardian set successfully.");
    callback();
  } catch (e) {
    callback(e);
  }
};
