#!/bin/bash -ex
set -x
set -e

source ${PROFILE}/.env

if [ -z $STAGE ]
then
  echo "[ERROR] No 'STAGE' configuration could be found in the '${PROFILE}/.env' file"
  exit 1
fi

pushd ../

echo "Building project ..."
mvn clean install -DskipTests -Dcheckstyle.skip=true

popd

pushd ../

export ARTIFACT_TIMESTAMP=$(date +"%Y%m%d%H%M%S")
echo "Artifact build timestamp: ${ARTIFACT_TIMESTAMP}"

export ARTIFACT_VERSION=$(mvn help:evaluate -Dexpression=project.version -q -DforceStdout)
echo "Artifact build version: ${ARTIFACT_VERSION}"

echo "Building artifact ..."
mvn -P build clean package -DskipTests -Dcheckstyle.skip=true

export LATEST_SOLUTION_STACK_NAME=$(aws elasticbeanstalk list-available-solution-stacks --region us-west-2 \
    --query "SolutionStacks[?ends_with(@, 'running Corretto 8')] | [0]" \
    --output text)
echo  "Latest EBS solution stack name: $LATEST_SOLUTION_STACK_NAME"

export ARTIFACT_NAME=sidekick-demo-todo-app-java-${ARTIFACT_VERSION}-${ARTIFACT_TIMESTAMP}.zip
echo "Artifact name: ${ARTIFACT_NAME}"

export ARTIFACT_S3_BUCKET=sidekick-releases-${STAGE}
export ARTIFACT_S3_KEY=sidekick-demo-todo-app-java/${ARTIFACT_NAME}
export ARTIFACT_S3_PATH=s3://${ARTIFACT_S3_BUCKET}/${ARTIFACT_S3_KEY}
echo "Uploading built artifact to ${ARTIFACT_S3_PATH} ..."
aws s3 cp target/sidekick-demo-todo-app-java.zip "${ARTIFACT_S3_PATH}"

popd

pushd app/

npm install
cdk bootstrap
cdk deploy sidekick-sandbox-todo-java-stack-${STAGE} --require-approval never

popd
