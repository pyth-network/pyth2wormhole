import { VAA_SIGNATURE_SIZE } from "./constants";

export function getGuardianSetIndex(vaa: Buffer) {
  return vaa.readUInt32BE(1);
}

export function trimSignatures(vaa: Buffer, n: number): Buffer {
  const currentNumSignatures = vaa[5];
  if (n > currentNumSignatures) {
    throw new Error(
      "Resulting VAA can't have more signatures than the original VAA"
    );
  }

  let trimmedVaa = Buffer.concat([
    vaa.subarray(0, 6 + n * VAA_SIGNATURE_SIZE),
    vaa.subarray(6 + currentNumSignatures * VAA_SIGNATURE_SIZE),
  ]);

  trimmedVaa[5] = n;
  return trimmedVaa;
}
