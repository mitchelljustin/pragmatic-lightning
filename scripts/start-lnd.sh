#!/bin/sh

curl -O https://raw.githubusercontent.com/mvanderh/pragmatic-lightning/master/preloaded_data.tar
tar xf preloaded_data.tar
curl -O https://raw.githubusercontent.com/mvanderh/pragmatic-lightning/master/rain-report/docker-compose.yml
docker-compose up -d
