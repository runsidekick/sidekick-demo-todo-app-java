#!/bin/bash -ex
set -x
set -e

export PROFILE=staging
export STACK_NAME=$1

pushd ../

./deploy.sh

popd
