# Pointz Infra (AWS CDK)

Deploys the Pointz app to AWS:

- **Network**: VPC (2 AZs, no NAT), security groups
- **Data**: RDS Postgres (`db.t4g.micro`), ECR repo, SSM JWT secret
- **App**: EC2 `t3.micro` (free-tier), Elastic IP, S3 SPA bucket, CloudFront distribution
- **CI/CD**: GitHub OIDC role for `garyouyang9449/pointz@main`

Region: `us-west-1`. Account: `248785326709`.

Public URL after deploy: `https://<distribution-id>.cloudfront.net` (printed as the `PublicUrl` output of `PointzAppStack`).

---

## Prerequisites (one-time, local machine)

1. Install AWS CLI v2 and configure credentials for account `248785326709`:
   ```bash
   aws configure
   # default region: us-west-1
   ```
2. Install Node 20+ and Docker (Docker only needed for the one-time bootstrap image push).
3. From this directory:
   ```bash
   npm install
   npm install -g aws-cdk      # or use `npx cdk` everywhere
   ```
4. Bootstrap CDK in the target account/region (creates the CDK staging bucket/role):
   ```bash
   npx cdk bootstrap aws://248785326709/us-west-1
   ```

---

## First-time deploy

CloudFormation stacks must come up in this order; the bootstrap image push happens between `DataStack` and `AppStack` because EC2 user-data tries to pull `pointz-server:latest` on boot.

### 1. Deploy network + data
```bash
npm run build
npx cdk deploy PointzNetworkStack PointzDataStack
```

Note the `EcrRepoUri` output (e.g. `248785326709.dkr.ecr.us-west-1.amazonaws.com/pointz-server`).

### 2. Push the initial server image to ECR
```bash
aws ecr get-login-password --region us-west-1 \
  | docker login --username AWS --password-stdin 248785326709.dkr.ecr.us-west-1.amazonaws.com

docker buildx build \
  --platform linux/amd64 \
  -t 248785326709.dkr.ecr.us-west-1.amazonaws.com/pointz-server:latest \
  --push \
  ../server
```

### 3. Deploy the app stack (EC2, S3 bucket, CloudFront)
```bash
npx cdk deploy PointzAppStack
```

Outputs include:
- `InstanceId` — the EC2 instance
- `PublicUrl` — your `https://...cloudfront.net` URL
- `Ec2PublicDns` — the origin CloudFront talks to

### 4. Run database migrations & seed (one-time, manually)

Open an SSM session (no SSH key needed):
```bash
aws ssm start-session --target <InstanceId> --region us-west-1
```

Then on the instance:
```bash
sudo -i
cd /opt/pointz
docker compose exec api node dist/lib/migrate.js
docker compose exec api node dist/lib/seed.js
exit
```

### 5. Build & upload the SPA the first time
```bash
cd ../client
npm ci
npm run build
aws s3 sync dist s3://pointz-spa-248785326709-us-west-1 --delete --region us-west-1
aws cloudfront create-invalidation \
  --distribution-id <DistributionId> \
  --paths "/*" --region us-west-1
```

### 6. Deploy the CI/CD stack
```bash
cd ../infra
npx cdk deploy PointzCicdStack
```

Note the `DeployRoleArn` output.

### 7. Configure GitHub repo variables

In `garyouyang9449/pointz` → Settings → Secrets and variables → Actions → **Variables** tab, add:

| Name | Value |
|---|---|
| `AWS_DEPLOY_ROLE_ARN` | from `PointzCicdStack.DeployRoleArn` output |
| `EC2_INSTANCE_ID` | from `PointzAppStack.InstanceId` output |
| `SPA_BUCKET` | `pointz-spa-248785326709-us-west-1` |
| `CF_DISTRIBUTION_ID` | from `PointzAppStack.DistributionId` output |

Push to `main` and the `deploy-server` / `deploy-client` workflows will take over.

---

## Verification

1. `curl https://<dist>.cloudfront.net/api/cards` should return JSON.
2. Browse `https://<dist>.cloudfront.net/` — the SPA should load and login should work.

## Cost (low traffic, year 1)

~$1–3/mo while in free tier; ~$25/mo afterward (mostly RDS + EC2 + Secrets Manager).

## Tearing down

`npx cdk destroy --all` — note RDS, S3, and ECR have `RETAIN` policies; you must delete them manually if you want a full cleanup.
