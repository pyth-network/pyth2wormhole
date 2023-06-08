export type MockCpiCaller = {
  version: "0.1.0";
  name: "mock_cpi_caller";
  instructions: [
    {
      name: "addPrice";
      docs: ["Creates a `PriceAccount` with the given parameters"];
      accounts: [
        {
          name: "pythPriceAccount";
          isMut: true;
          isSigner: false;
          pda: {
            seeds: [
              {
                kind: "const";
                type: "string";
                value: "pyth";
              },
              {
                kind: "const";
                type: "string";
                value: "price";
              },
              {
                kind: "arg";
                type: {
                  defined: "AddPriceParams";
                };
                path: "params.id";
              }
            ];
          };
        },
        {
          name: "payer";
          isMut: true;
          isSigner: true;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
          docs: ["also needed for accumulator_updater"];
        },
        {
          name: "accumulatorWhitelist";
          isMut: false;
          isSigner: false;
        },
        {
          name: "auth";
          isMut: false;
          isSigner: false;
          docs: [
            "PDA representing this program's authority",
            "to call the accumulator program"
          ];
          pda: {
            seeds: [
              {
                kind: "const";
                type: "string";
                value: "upd_price_write";
              },
              {
                kind: "account";
                type: "publicKey";
                path: "message_buffer_program";
              }
            ];
          };
        },
        {
          name: "messageBufferProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "params";
          type: {
            defined: "AddPriceParams";
          };
        }
      ];
    },
    {
      name: "updatePrice";
      docs: ["Updates a `PriceAccount` with the given parameters"];
      accounts: [
        {
          name: "pythPriceAccount";
          isMut: true;
          isSigner: false;
          pda: {
            seeds: [
              {
                kind: "const";
                type: "string";
                value: "pyth";
              },
              {
                kind: "const";
                type: "string";
                value: "price";
              },
              {
                kind: "account";
                type: "publicKey";
                path: "pyth_price_account";
              }
            ];
          };
        },
        {
          name: "accumulatorWhitelist";
          isMut: false;
          isSigner: false;
        },
        {
          name: "auth";
          isMut: false;
          isSigner: false;
          pda: {
            seeds: [
              {
                kind: "const";
                type: "string";
                value: "upd_price_write";
              },
              {
                kind: "account";
                type: "publicKey";
                path: "message_buffer_program";
              }
            ];
          };
        },
        {
          name: "messageBufferProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "params";
          type: {
            defined: "UpdatePriceParams";
          };
        }
      ];
    },
    {
      name: "cpiMaxTest";
      docs: ["num_messages is the number of 1kb messages to send to the CPI"];
      accounts: [
        {
          name: "pythPriceAccount";
          isMut: true;
          isSigner: false;
          pda: {
            seeds: [
              {
                kind: "const";
                type: "string";
                value: "pyth";
              },
              {
                kind: "const";
                type: "string";
                value: "price";
              },
              {
                kind: "account";
                type: "publicKey";
                path: "pyth_price_account";
              }
            ];
          };
        },
        {
          name: "accumulatorWhitelist";
          isMut: false;
          isSigner: false;
        },
        {
          name: "auth";
          isMut: false;
          isSigner: false;
          pda: {
            seeds: [
              {
                kind: "const";
                type: "string";
                value: "upd_price_write";
              },
              {
                kind: "account";
                type: "publicKey";
                path: "message_buffer_program";
              }
            ];
          };
        },
        {
          name: "messageBufferProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "params";
          type: {
            defined: "UpdatePriceParams";
          };
        },
        {
          name: "msgSizes";
          type: {
            vec: "u16";
          };
        }
      ];
    }
  ];
  accounts: [
    {
      name: "priceAccount";
      type: {
        kind: "struct";
        fields: [
          {
            name: "id";
            type: "u64";
          },
          {
            name: "price";
            type: "u64";
          },
          {
            name: "priceExpo";
            type: "u64";
          },
          {
            name: "ema";
            type: "u64";
          },
          {
            name: "emaExpo";
            type: "u64";
          },
          {
            name: "comp";
            type: {
              array: ["publicKey", 32];
            };
          }
        ];
      };
    }
  ];
  types: [
    {
      name: "AddPriceParams";
      type: {
        kind: "struct";
        fields: [
          {
            name: "id";
            type: "u64";
          },
          {
            name: "price";
            type: "u64";
          },
          {
            name: "priceExpo";
            type: "u64";
          },
          {
            name: "ema";
            type: "u64";
          },
          {
            name: "emaExpo";
            type: "u64";
          }
        ];
      };
    },
    {
      name: "UpdatePriceParams";
      type: {
        kind: "struct";
        fields: [
          {
            name: "price";
            type: "u64";
          },
          {
            name: "priceExpo";
            type: "u64";
          },
          {
            name: "ema";
            type: "u64";
          },
          {
            name: "emaExpo";
            type: "u64";
          }
        ];
      };
    },
    {
      name: "MessageSchema";
      type: {
        kind: "enum";
        variants: [
          {
            name: "Full";
          },
          {
            name: "Compact";
          },
          {
            name: "Minimal";
          },
          {
            name: "Dummy";
          }
        ];
      };
    },
    {
      name: "PythAccountType";
      type: {
        kind: "enum";
        variants: [
          {
            name: "Mapping";
          },
          {
            name: "Product";
          },
          {
            name: "Price";
          },
          {
            name: "Test";
          },
          {
            name: "Permissions";
          }
        ];
      };
    }
  ];
};

export const IDL: MockCpiCaller = {
  version: "0.1.0",
  name: "mock_cpi_caller",
  instructions: [
    {
      name: "addPrice",
      docs: ["Creates a `PriceAccount` with the given parameters"],
      accounts: [
        {
          name: "pythPriceAccount",
          isMut: true,
          isSigner: false,
          pda: {
            seeds: [
              {
                kind: "const",
                type: "string",
                value: "pyth",
              },
              {
                kind: "const",
                type: "string",
                value: "price",
              },
              {
                kind: "arg",
                type: {
                  defined: "AddPriceParams",
                },
                path: "params.id",
              },
            ],
          },
        },
        {
          name: "payer",
          isMut: true,
          isSigner: true,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
          docs: ["also needed for accumulator_updater"],
        },
        {
          name: "accumulatorWhitelist",
          isMut: false,
          isSigner: false,
        },
        {
          name: "auth",
          isMut: false,
          isSigner: false,
          docs: [
            "PDA representing this program's authority",
            "to call the accumulator program",
          ],
          pda: {
            seeds: [
              {
                kind: "const",
                type: "string",
                value: "upd_price_write",
              },
              {
                kind: "account",
                type: "publicKey",
                path: "message_buffer_program",
              },
            ],
          },
        },
        {
          name: "messageBufferProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "params",
          type: {
            defined: "AddPriceParams",
          },
        },
      ],
    },
    {
      name: "updatePrice",
      docs: ["Updates a `PriceAccount` with the given parameters"],
      accounts: [
        {
          name: "pythPriceAccount",
          isMut: true,
          isSigner: false,
          pda: {
            seeds: [
              {
                kind: "const",
                type: "string",
                value: "pyth",
              },
              {
                kind: "const",
                type: "string",
                value: "price",
              },
              {
                kind: "account",
                type: "publicKey",
                path: "pyth_price_account",
              },
            ],
          },
        },
        {
          name: "accumulatorWhitelist",
          isMut: false,
          isSigner: false,
        },
        {
          name: "auth",
          isMut: false,
          isSigner: false,
          pda: {
            seeds: [
              {
                kind: "const",
                type: "string",
                value: "upd_price_write",
              },
              {
                kind: "account",
                type: "publicKey",
                path: "message_buffer_program",
              },
            ],
          },
        },
        {
          name: "messageBufferProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "params",
          type: {
            defined: "UpdatePriceParams",
          },
        },
      ],
    },
    {
      name: "cpiMaxTest",
      docs: ["num_messages is the number of 1kb messages to send to the CPI"],
      accounts: [
        {
          name: "pythPriceAccount",
          isMut: true,
          isSigner: false,
          pda: {
            seeds: [
              {
                kind: "const",
                type: "string",
                value: "pyth",
              },
              {
                kind: "const",
                type: "string",
                value: "price",
              },
              {
                kind: "account",
                type: "publicKey",
                path: "pyth_price_account",
              },
            ],
          },
        },
        {
          name: "accumulatorWhitelist",
          isMut: false,
          isSigner: false,
        },
        {
          name: "auth",
          isMut: false,
          isSigner: false,
          pda: {
            seeds: [
              {
                kind: "const",
                type: "string",
                value: "upd_price_write",
              },
              {
                kind: "account",
                type: "publicKey",
                path: "message_buffer_program",
              },
            ],
          },
        },
        {
          name: "messageBufferProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "params",
          type: {
            defined: "UpdatePriceParams",
          },
        },
        {
          name: "msgSizes",
          type: {
            vec: "u16",
          },
        },
      ],
    },
  ],
  accounts: [
    {
      name: "priceAccount",
      type: {
        kind: "struct",
        fields: [
          {
            name: "id",
            type: "u64",
          },
          {
            name: "price",
            type: "u64",
          },
          {
            name: "priceExpo",
            type: "u64",
          },
          {
            name: "ema",
            type: "u64",
          },
          {
            name: "emaExpo",
            type: "u64",
          },
          {
            name: "comp",
            type: {
              array: ["publicKey", 32],
            },
          },
        ],
      },
    },
  ],
  types: [
    {
      name: "AddPriceParams",
      type: {
        kind: "struct",
        fields: [
          {
            name: "id",
            type: "u64",
          },
          {
            name: "price",
            type: "u64",
          },
          {
            name: "priceExpo",
            type: "u64",
          },
          {
            name: "ema",
            type: "u64",
          },
          {
            name: "emaExpo",
            type: "u64",
          },
        ],
      },
    },
    {
      name: "UpdatePriceParams",
      type: {
        kind: "struct",
        fields: [
          {
            name: "price",
            type: "u64",
          },
          {
            name: "priceExpo",
            type: "u64",
          },
          {
            name: "ema",
            type: "u64",
          },
          {
            name: "emaExpo",
            type: "u64",
          },
        ],
      },
    },
    {
      name: "MessageSchema",
      type: {
        kind: "enum",
        variants: [
          {
            name: "Full",
          },
          {
            name: "Compact",
          },
          {
            name: "Minimal",
          },
          {
            name: "Dummy",
          },
        ],
      },
    },
    {
      name: "PythAccountType",
      type: {
        kind: "enum",
        variants: [
          {
            name: "Mapping",
          },
          {
            name: "Product",
          },
          {
            name: "Price",
          },
          {
            name: "Test",
          },
          {
            name: "Permissions",
          },
        ],
      },
    },
  ],
};
