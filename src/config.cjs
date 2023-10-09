const { GetSecretValueCommand, SecretsManagerClient } = require('@aws-sdk/client-secrets-manager');
const { GetParametersByPathCommand, SSMClient } = require('@aws-sdk/client-ssm');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const DEFAULT_AWS_REGION = 'us-east-1';

let cachedConfig = undefined;

/**
 * Returns the server configuration settings.
 * @returns The server configuration settings.
 */
function getConfig() {
  if (!cachedConfig) {
    throw new Error('Config not loaded');
  }
  return cachedConfig;
}

/**
 * Loads configuration settings from a config identifier.
 * The identifier must start with one of the following prefixes:
 *   1) "file:" string followed by relative path.
 *   2) "aws:" followed by AWS SSM path prefix.
 * @param {string} configName The medplum config identifier.
 * @returns The loaded configuration.
 */
async function loadConfig(configName) {
  const [configType, configPath] = splitOnce(configName, ':');
  switch (configType) {
    case 'file':
      cachedConfig = await loadFileConfig(configPath);
      break;
    case 'aws':
      cachedConfig = await loadAwsConfig(configPath);
      break;
    default:
      throw new Error('Unrecognized config type: ' + configType);
  }
  cachedConfig = addDefaults(cachedConfig);
  return cachedConfig;
}

/**
 * Loads configuration settings from a JSON file.
 * Path relative to the current working directory at runtime.
 * @param path The config file path.
 * @returns The configuration.
 */
async function loadFileConfig(path) {
  return JSON.parse(readFileSync(resolve(__dirname, '../', path), { encoding: 'utf8' }));
}

/**
 * Loads configuration settings from AWS SSM Parameter Store.
 * @param path The AWS SSM Parameter Store path prefix.
 * @returns The loaded configuration.
 */
async function loadAwsConfig(path) {
  let region = DEFAULT_AWS_REGION;
  if (path.includes(':')) {
    [region, path] = splitOnce(path, ':');
  }

  const client = new SSMClient({ region });
  const config = {};

  let nextToken;
  do {
    const response = await client.send(
      new GetParametersByPathCommand({
        Path: path,
        NextToken: nextToken,
        WithDecryption: true,
      })
    );
    if (response.Parameters) {
      for (const param of response.Parameters) {
        const key = param.Name.replace(path, '');
        const value = param.Value;
        if (key === 'DatabaseSecrets') {
          config['database'] = await loadAwsSecrets(region, value);
        } else if (key === 'RedisSecrets') {
          config['redis'] = await loadAwsSecrets(region, value);
        } else if (isIntegerConfig(key)) {
          config.port = parseInt(value, 10);
        } else if (isBooleanConfig(key)) {
          config[key] = value === 'true';
        } else {
          config[key] = value;
        }
      }
    }
    nextToken = response.NextToken;
  } while (nextToken);

  return config;
}

/**
 * Returns the AWS Database Secret data as a JSON map.
 * @param region The AWS region.
 * @param secretId Secret ARN
 * @returns The secret data as a JSON map.
 */
async function loadAwsSecrets(region, secretId) {
  const client = new SecretsManagerClient({ region });
  const result = await client.send(new GetSecretValueCommand({ SecretId: secretId }));

  if (!result.SecretString) {
    return undefined;
  }

  return JSON.parse(result.SecretString);
}

/**
 * Adds default values to the config.
 * @param config The input config as loaded from the config file.
 * @returns The config with default values added.
 */
function addDefaults(config) {
  config.port = config.port || 8103;
  config.issuer = config.issuer || config.baseUrl;
  config.jwksUrl = config.jwksUrl || config.baseUrl + '/.well-known/jwks.json';
  config.authorizeUrl = config.authorizeUrl || config.baseUrl + '/authorize';
  config.tokenUrl = config.tokenUrl || config.baseUrl + '/token';
  config.userInfoUrl = config.userInfoUrl || config.baseUrl + '/userinfo';
  config.storageBaseUrl = config.storageBaseUrl || config.baseUrl + '/storage';
  config.maxJsonSize = config.maxJsonSize || '1mb';
  config.awsRegion = config.awsRegion || DEFAULT_AWS_REGION;
  config.botLambdaLayerName = config.botLambdaLayerName || 'medplum-bot-layer';
  config.bcryptHashSalt = config.bcryptHashSalt || 10;
  return config;
}

function splitOnce(value, delimiter) {
  const index = value.indexOf(delimiter);
  if (index === -1) {
    return [value, ''];
  }
  return [value.substring(0, index), value.substring(index + 1)];
}

function isIntegerConfig(key) {
  return key === 'port';
}

function isBooleanConfig(key) {
  return (
    key === 'botCustomFunctionsEnabled' || key === 'logAuditEvents' || key === 'registerEnabled'
  );
}

module.exports = {
  getConfig,
  loadConfig,
};
