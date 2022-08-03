#!/bin/bash -ex
set -x
set -e

export PROFILE=lab

pushd ../

./deploy.sh

popd
