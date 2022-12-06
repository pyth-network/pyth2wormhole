use {
  crate::state::PythDataSource,
  cosmwasm_std::Binary,
  schemars::JsonSchema,
  serde::{
    Deserialize,
    Serialize,
  },
};

type HumanAddr = String;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
pub struct GovernanceInstruction {
  pub wormhole_contract:  HumanAddr,
  pub pyth_emitter:       Binary,
  pub pyth_emitter_chain: u16,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ExecuteMsg {
  UpdatePriceFeeds { data: Binary },
  AddDataSource { data_source: PythDataSource },
  RemoveDataSource { data_source: PythDataSource },
  ExecuteGovernanceInstruction { data: Binary },
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub struct MigrateMsg {}

pub use pyth_sdk_cw::{
  PriceFeedResponse,
  QueryMsg,
};
