import {Stack, StackProps, CfnOutput, RemovalPolicy} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Duration } from 'aws-cdk-lib';
import { PythonFunction } from '@aws-cdk/aws-lambda-python-alpha';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';

export class CloudGalleryStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const galleryBucket = new s3.Bucket(this, 'GalleryBucket', {
      versioned: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    galleryBucket.addCorsRule({
      allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET, s3.HttpMethods.HEAD],
      allowedOrigins: ['http://localhost:5173', 'https://ds7f7bvhq6eaf.cloudfront.net'],
      allowedHeaders: ['*'],
    });

    const distro = new cloudfront.Distribution(this, 'CDN', {
      defaultBehavior: {
        origin: new origins.S3Origin(galleryBucket),
        compress: true,
      },
      defaultRootObject: 'index.html',
    });

    const table = new dynamodb.Table(this, 'Images', {
      partitionKey: {name: 'imageId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY
    })

    const apiFn = new lambda.Function(this, 'ApiFn', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'api.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambdas/api')),
      environment: {
        TABLE: table.tableName,
        BUCKET: galleryBucket.bucketName
      },
      memorySize: 128,
      timeout: Duration.seconds(10)

    });

    table.grantReadWriteData(apiFn);
    galleryBucket.grantPut(apiFn);

    const api = new apigw.RestApi(this, 'GalleryApi', {
      defaultCorsPreflightOptions: {
        allowOrigins: apigw.Cors.ALL_ORIGINS
      }
    })

    const images = api.root.addResource('images');
    images.addMethod('GET', new apigw.LambdaIntegration(apiFn))
    images.addMethod('POST', new apigw.LambdaIntegration(apiFn))

    const processFn = new PythonFunction(this, 'ProcessFn', {
      entry: path.join(__dirname, '../lambdas/process'),
      runtime: lambda.Runtime.PYTHON_3_11,
      index: 'process.py',
      handler: 'handler',
      memorySize: 256,
      timeout: Duration.seconds(30),
      environment: {
        TABLE: table.tableName,
        BUCKET: galleryBucket.bucketName
      }
    });

    galleryBucket.grantReadWrite(processFn);
    table.grantWriteData(processFn)
    processFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['rekognition:DetectLabels'],
        resources: ['*']
      })
    );

    galleryBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED_PUT,
      new s3n.LambdaDestination(processFn),
      { suffix: '.jpg' }
    );

    new CfnOutput(this, 'GalleryBucketName', {
      value: galleryBucket.bucketName,
      description: 'The name of the S3 bucket for images.'
    });

    new CfnOutput(this, 'CDNDomainName', {
      value: distro.domainName,
      description: 'CloudFront domain for the SPA',
    });

    new CfnOutput(this, 'CDNDistributionId', {
      value: distro.distributionId,
      description: 'Distribution ID (for invalidations)',
    });

    new CfnOutput(this, 'ImageTablesName', {
      value: table.tableName
    })

    new CfnOutput(this, 'GalleryApiUrl', { value: api.url });



  }
}
