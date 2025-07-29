import { Stack, StackProps, CfnOutput, RemovalPolicy, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';

import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as cognito from 'aws-cdk-lib/aws-cognito';

import { PythonFunction } from '@aws-cdk/aws-lambda-python-alpha';
import {
  IdentityPool,
  UserPoolAuthenticationProvider,
} from '@aws-cdk/aws-cognito-identitypool-alpha';

import * as path from 'path';

export class CloudGalleryStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    /* ───────────── Storage & CDN ───────────── */
    const galleryBucket = new s3.Bucket(this, 'GalleryBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    galleryBucket.addCorsRule({
      allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET, s3.HttpMethods.HEAD],
      allowedOrigins: [
        'http://localhost:5173',
        'https://ds7f7bvhq6eaf.cloudfront.net',
      ],
      allowedHeaders: ['*'],
    });

    const spaBucket = new s3.Bucket(this, 'SpaBucket', {
      websiteIndexDocument: 'index.html',
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const spaDistro = new cloudfront.Distribution(this, 'SpaCDN', {
      defaultBehavior: {
        origin: new origins.S3Origin(spaBucket),
        compress: true,
      },
      defaultRootObject: 'index.html',
    });

    const distro = new cloudfront.Distribution(this, 'CDN', {
      defaultBehavior: {
        origin: new origins.S3Origin(galleryBucket),
        compress: true,
      },
      defaultRootObject: 'index.html',
    });

    /* ───────────── Data table ──────────────── */
    const table = new dynamodb.Table(this, 'Images', {
      partitionKey: { name: 'imageId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    /* ───────────── Cognito ──────────── */
    const userPool = new cognito.UserPool(this, 'GalleryUsers', {
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const userClient = userPool.addClient('WebClient', {
      authFlows: { userPassword: true, userSrp: true },
      oAuth: {
        flows: { implicitCodeGrant: true },
        callbackUrls: ['http://localhost:5173'],
        logoutUrls: ['http://localhost:5173'],
      },
    });

    const userPoolProvider = new UserPoolAuthenticationProvider({
      userPool,
      userPoolClient: userClient,
    });

    const idPool = new IdentityPool(this, 'IdPool', {
      identityPoolName: 'GalleryPool',
      authenticationProviders: { userPools: [userPoolProvider] },
    });

    idPool.unauthenticatedRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ['execute-api:Invoke'],
        resources: ['*'],
      }),
    );
    idPool.authenticatedRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ['execute-api:Invoke'],
        resources: ['*'],
      }),
    );

    /* ───────────── Lambda functions ────────── */
    const apiFn = new lambda.Function(this, 'ApiFn', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'api.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambdas/api')),
      environment: {
        TABLE: table.tableName,
        BUCKET: galleryBucket.bucketName,
      },
      memorySize: 128,
      timeout: Duration.seconds(10),
    });
    table.grantReadWriteData(apiFn);
    galleryBucket.grantPut(apiFn);

    const processFn = new PythonFunction(this, 'ProcessFn', {
      entry: path.join(__dirname, '../lambdas/process'),
      runtime: lambda.Runtime.PYTHON_3_11,
      index: 'process.py',
      handler: 'handler',
      environment: {
        TABLE: table.tableName,
        BUCKET: galleryBucket.bucketName,
      },
      memorySize: 256,
      timeout: Duration.seconds(30),
    });
    galleryBucket.grantReadWrite(processFn);
    table.grantWriteData(processFn);
    processFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['rekognition:DetectLabels'],
        resources: ['*'],
      }),
    );
    galleryBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED_PUT,
      new s3n.LambdaDestination(processFn),
      { suffix: '.jpg' },
    );

    /* ───────────── API Gateway ─────────────── */
    const api = new apigw.RestApi(this, 'GalleryApi', {
      defaultCorsPreflightOptions: {
        allowOrigins: apigw.Cors.ALL_ORIGINS,
      },
    });

    const images = api.root.addResource('images');
    images.addMethod('GET', new apigw.LambdaIntegration(apiFn));

    const authorizer = new apigw.CognitoUserPoolsAuthorizer(this, 'ApiAuth', {
      cognitoUserPools: [userPool],
    });
    images.addMethod('POST', new apigw.LambdaIntegration(apiFn), {
      authorizationType: apigw.AuthorizationType.COGNITO,
      authorizer,
    });

    /* ───────────── Outputs ─────────────────── */
    new CfnOutput(this, 'GalleryBucketName', { value: galleryBucket.bucketName });
    new CfnOutput(this, 'CDNDomainName', { value: distro.domainName });
    new CfnOutput(this, 'CDNDistributionId', { value: distro.distributionId });
    new CfnOutput(this, 'ImageTablesName', { value: table.tableName });
    new CfnOutput(this, 'GalleryApiUrl', { value: api.url });
    new CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new CfnOutput(this, 'UserPoolClientId', { value: userClient.userPoolClientId });
    new CfnOutput(this, 'IdentityPoolId', { value: idPool.identityPoolId });
    new CfnOutput(this, 'SpaURL', { value: `https://${spaDistro.domainName}` });
  }
}
