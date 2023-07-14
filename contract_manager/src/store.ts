import { AptosChain, Chain, CosmWasmChain, EVMChain, SuiChain } from "./chains";
import { CosmWasmContract } from "./cosmwasm";
import { SuiContract } from "./sui";
import { Contract } from "./base";
import { parse, stringify } from "yaml";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "fs";
import { EVMContract } from "./evm";
import { AptosContract } from "./aptos";

class Store {
  public chains: Record<string, Chain> = {};
  public contracts: Record<string, Contract> = {};

  constructor(public path: string) {
    this.loadAllChains();
    this.loadAllContracts();
  }

  save(obj: any) {
    let dir, file, content;
    if (obj instanceof Contract) {
      let contract = obj;
      dir = `${this.path}/contracts/${contract.getType()}`;
      file = contract.getId();
      content = contract.toJson();
    } else if (obj instanceof Chain) {
      let chain = obj;
      dir = `${this.path}/chains/${chain.getType()}`;
      file = chain.getId();
      content = chain.toJson();
    } else {
      throw new Error("Invalid type");
    }
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(`${dir}/${file}.yaml`, stringify(content));
  }

  getYamlFiles(path: string) {
    const walk = function (dir: string) {
      let results: string[] = [];
      const list = readdirSync(dir);
      list.forEach(function (file) {
        file = dir + "/" + file;
        const stat = statSync(file);
        if (stat && stat.isDirectory()) {
          // Recurse into a subdirectory
          results = results.concat(walk(file));
        } else {
          // Is a file
          results.push(file);
        }
      });
      return results;
    };
    return walk(path).filter((file) => file.endsWith(".yaml"));
  }

  loadAllChains() {
    let allChainClasses = {
      [CosmWasmChain.type]: CosmWasmChain,
      [SuiChain.type]: SuiChain,
      [EVMChain.type]: EVMChain,
      [AptosChain.type]: AptosChain,
    };

    this.getYamlFiles(`${this.path}/chains/`).forEach((yamlFile) => {
      let parsed = parse(readFileSync(yamlFile, "utf-8"));
      if (allChainClasses[parsed.type] === undefined) return;
      let chain = allChainClasses[parsed.type].fromJson(parsed);
      if (this.chains[chain.getId()])
        throw new Error(`Multiple chains with id ${chain.getId()} found`);
      this.chains[chain.getId()] = chain;
    });
  }

  loadAllContracts() {
    let allContractClasses = {
      [CosmWasmContract.type]: CosmWasmContract,
      [SuiContract.type]: SuiContract,
      [EVMContract.type]: EVMContract,
      [AptosContract.type]: AptosContract,
    };
    this.getYamlFiles(`${this.path}/contracts/`).forEach((yamlFile) => {
      let parsed = parse(readFileSync(yamlFile, "utf-8"));
      if (allContractClasses[parsed.type] === undefined) return;
      if (!this.chains[parsed.chain])
        throw new Error(`Chain ${parsed.chain} not found`);
      const chain = this.chains[parsed.chain];
      let chainContract = allContractClasses[parsed.type].fromJson(
        chain,
        parsed
      );
      if (this.contracts[chainContract.getId()])
        throw new Error(
          `Multiple contracts with id ${chainContract.getId()} found`
        );
      this.contracts[chainContract.getId()] = chainContract;
    });
  }
}

export const DefaultStore = new Store(`${__dirname}/../store`);
