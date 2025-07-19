import boto3, os, json, uuid

table = boto3.resource('dynamodb').Table(os.environ['TABLE'])
bucket = os.environ['BUCKET']
s3 = boto3.client('s3')

def handler(event, _):
    method = event.get('httpMethod')
    if method == 'GET':
        items = table.scan().get('Items', [])
        return _resp(200, items)
    
    if method == 'POST':
        image_id = str(uuid.uuid4())
        presigned = s3.generate_presigned_url(
            'put_object',
            Params={'Bucket': bucket, 'Key': f"{image_id}.jpg"},
            ExpiresIn=900
        )
        table.put_item(Item={'imageId': image_id, 'status': 'UPLOADING'})
        return _resp(201, {'imageId': image_id, 'uploadUrl': presigned})
    
    return _resp(405, {'error': "Method not allowed"})

def _resp(code, body):
    return {'statusCode': code,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps(body)}