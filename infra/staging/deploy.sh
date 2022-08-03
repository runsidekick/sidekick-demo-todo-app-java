#!/bin/bash -ex
set -x
set -e

export PROFILE=staging

pushd ../

./deploy.sh

popd
