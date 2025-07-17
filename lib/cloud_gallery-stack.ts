import {Stack, StackProps, CfnOutput} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';

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

  }
}
