#!/bin/bash -ex
set -x
set -e

export PROFILE=prod

pushd ../

./deploy.sh

popd
