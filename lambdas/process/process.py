import os, json, io, boto3
from PIL import Image

s3 = boto3.client('s3')
rek = boto3.client('rekognition')
table = boto3.resource('dynamodb').Table(os.environ['TABLE'])
BUCKET = os.environ['BUCKET']

def handler(event, _):
    for rec in event['Records']:
        key = rec['s3']['object']['key']
        if key.startswith('thumb/'):
            continue

        image_id = key.rsplit('.', 1)[0]
        obj = s3.get_object(Bucket=BUCKET, Key=key)
        img_bytes = obj['Body'].read()

        thumb_key = f"thumb/{image_id}.jpg"
        img = Image.open(io.BytesIO(img_bytes))
        img.thumbnail((256, 256))
        buf = io.BytesIO()
        img.save(buf, format='JPEG')
        buf.seek(0)
        s3.put_object(Bucket=BUCKET, Key=thumb_key, Body=buf, ContentType='image/jpeg')

        rsp = rek.detect_labels(Image={'Bytes': img_bytes}, MaxLabels=5)
        labels = [l['Name'] for l in rsp['Labels']]

        table.update_item(
            Key={'imageId': image_id},
            UpdateExpression="SET #st = :r, labels = :l, thumbKey = :t",
            ExpressionAttributeNames={'#st': 'status'},
            ExpressionAttributeValues={
                ':r': 'READY',
                ':l': labels,
                ':t': thumb_key
            }
        )

    return {"statusCode": 200, "body": json.dumps('ok')}