export type EnvironmentName = 'development' | 'staging' | 'production';

type EnvironmentConfig = {
  apiBaseUrl: string;
  environmentName: EnvironmentName;
};

const apiBaseUrls: Record<EnvironmentName, string> = {
  development: 'http://pickndrop.test/api/v1',
  staging: 'https://pickndrop-main-ljjmtf.laravel.cloud/api/v1',
  production: 'https://pickndrop.example/api/v1',
};

function resolveEnvironmentName(): EnvironmentName {
  const configuredEnvironment = process.env.EXPO_PUBLIC_APP_ENV;

  if (configuredEnvironment === 'staging' || configuredEnvironment === 'production') {
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
