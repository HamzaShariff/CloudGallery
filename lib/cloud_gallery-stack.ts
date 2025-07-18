import {Stack, StackProps, CfnOutput, RemovalPolicy} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Duration } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as path from 'path';

export class CloudGalleryStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const galleryBucket = new s3.Bucket(this, 'GalleryBucket', {
      versioned: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
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
