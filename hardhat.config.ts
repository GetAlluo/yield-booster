import * as dotenv from "dotenv";

import { HardhatUserConfig } from "hardhat/config";
import 'hardhat-contract-sizer'
import './tasks'
import '@openzeppelin/hardhat-upgrades';

import "@nomicfoundation/hardhat-toolbox";

dotenv.config();
const config: HardhatUserConfig = {
  solidity: {
    compilers: [

      {
        version: "0.8.17",
        settings: {
          // viaIR: true,
          optimizer: {
            enabled: true,
            runs: 0,

          }
        },
      }
    ]

  },
  networks: {
    hardhat: {
      // forking: {
      //   enabled: process.env.FORKING_ENABLED == "true",
      //   url: process.env.MAINNET_FORKING_URL as string,
      //   blockNumber: 16428096
      // }
      allowUnlimitedContractSize: true,
    },
    mainnet: {
      url: process.env.MAINNET_URL,
      gasPrice: "auto",
      accounts: {
        mnemonic: process.env.MNEMONIC,
      },
    },
    polygon: {
      url: process.env.POLYGON_URL,
      gasPrice: "auto",
      accounts: {
        mnemonic: process.env.MNEMONIC,
      },
    },

    optimisticEthereum: {
      url: process.env.OPTIMISM_URL,
      gasPrice: "auto",
      accounts: process.env.ALLUO_DEPLOYER_PRIVATE_KEY != undefined ? [process.env.ALLUO_DEPLOYER_PRIVATE_KEY] : { mnemonic: process.env.MNEMONIC as string }

    },
    // TESTNETS
    mumbai: {
      url: process.env.MUMBAI_URL,
      gasPrice: "auto",
      accounts: {
        mnemonic: process.env.MNEMONIC,
      },
    },

    rinkeby: {
      url: process.env.RINKEBY_URL,
      gasPrice: 25000000000,
      accounts: {
        mnemonic: process.env.MNEMONIC,
      },
    },
    goerli: {
      url: process.env.GOERLI_URL,
      gasPrice: "auto",
      accounts: {
        mnemonic: process.env.MNEMONIC,
      },
    },

  },

  gasReporter: {
    enabled: process.env.REPORT_GAS == "true",
    currency: "USD",
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY != undefined ? process.env.ETHERSCAN_API_KEY : "",
      polygon: process.env.POLYGONSCAN_API_KEY != undefined ? process.env.POLYGONSCAN_API_KEY : "",
      optimisticEthereum: process.env.OPTIMISMSCAN_API_KEY != undefined ? process.env.OPTIMISMSCAN_API_KEY : ""
    }
  },

  mocha: {
    timeout: 3600000,
  },
  contractSizer: {
    alphaSort: false,
    disambiguatePaths: false,
    runOnCompile: process.env.CONTRACT_SIZER == "true",
    strict: false,
  }
}

export default config;