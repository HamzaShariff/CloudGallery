import type { ResourcesConfig } from 'aws-amplify';

export const awsConfig: ResourcesConfig = {
  Auth: {        
    Cognito: {
      userPoolId:      import.meta.env.VITE_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID,
      identityPoolId:  import.meta.env.VITE_ID_POOL_ID,
    },
  },
};