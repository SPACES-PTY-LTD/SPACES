export type EnvironmentName = 'development' | 'staging' | 'production';

type EnvironmentConfig = {
  apiBaseUrl: string;
  environmentName: EnvironmentName;
};

const apiBaseUrls: Record<EnvironmentName, string> = {
  development: 'https://api.spaces.za.com/api/v1',
  staging: 'https://api.spaces.za.com/api/v1',
  production: 'https://api.spaces.za.com/api/v1',
};

function resolveEnvironmentName(): EnvironmentName {
  const configuredEnvironment = process.env.EXPO_PUBLIC_APP_ENV;

  if (
    configuredEnvironment === 'development' ||
    configuredEnvironment === 'staging' ||
    configuredEnvironment === 'production'
  ) {
    return configuredEnvironment;
  }

  return 'staging';
}

export function getEnvironmentConfig(): EnvironmentConfig {
  const environmentName = resolveEnvironmentName();

  return {
    environmentName,
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || apiBaseUrls[environmentName],
  };
}
