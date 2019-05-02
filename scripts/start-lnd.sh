#!/bin/sh

set -x

curl -O https://media.githubusercontent.com/media/mvanderh/pragmatic-lightning/master/preloaded_data.tar \
    -O https://raw.githubusercontent.com/mvanderh/pragmatic-lightning/master/rain-report/docker-compose.yml
tar xvf preloaded_data.tar
docker-compose up
rm preloaded_data.tar
