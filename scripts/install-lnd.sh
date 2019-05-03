#!/bin/sh

set -x

# This script installs lnd.
#
# Quick install: `curl https://getmic.ro | bash`
#
# This script will install lnd to the directory you're in. To install
# somewhere else (e.g. /usr/local/bin), cd there and make sure you can write to
# that directory, e.g. `cd /usr/local/bin; curl https://raw.githubusercontent.com/mvanderh/pragmatic-lightning/master/scripts/install-lnd.sh | sudo bash`
#
# Acknowledgments:
#   - Shamelessly copied from https://getmic.ro/


set -e
set -u
set -o pipefail

function githubLatestTag {
    finalUrl=$(curl "https://github.com/$1/releases/latest" -s -L -I -o /dev/null -w '%{url_effective}')
    echo "${finalUrl##*v}"
}

UNKNOWN_OS_MSG= <<-'EOM'
/=====================================\
|      COULD NOT DETECT PLATFORM      |
\=====================================/

To continue with installation, please choose from one of the following values:

- freebsd32
- freebsd64
- linux-arm
- linux32
- linux64
- netbsd32
- netbsd64
- openbsd32
- openbsd64
- osx
EOM


platform=''
machine=$(uname -m)

if [[ "$OSTYPE" == "linux-gnu"* ]]; then
  if [[ "$machine" == "arm"* || "$machine" == "aarch"* ]]; then
    platform='linux-armv7'
  elif [[ "$machine" == *"86" ]]; then
    platform='linux-386'
  elif [[ "$machine" == *"64" ]]; then
    platform='linux-amd64'
  fi
elif [[ "$OSTYPE" == "darwin"* ]]; then
  if [[ "$machine" == *"86" ]]; then
    platform='darwin-386'
  elif [[ "$machine" == *"64" ]]; then
    platform='darwin-amd64'
  fi
elif [[ "$OSTYPE" == "freebsd"* ]]; then
  if [[ "$machine" == *"64" ]]; then
    platform='freebsd-amd64'
  elif [[ "$machine" == *"86" ]]; then
    platform='freebsd-386'
  fi
elif [[ "$OSTYPE" == "openbsd"* ]]; then
  if [[ "$machine" == *"64" ]]; then
    platform='openbsd-amd64'
  elif [[ "$machine" == *"86" ]]; then
    platform='openbsd-386'
  fi
elif [[ "$OSTYPE" == "netbsd"* ]]; then
  if [[ "$machine" == *"64" ]]; then
    platform='netbsd-amd64'
  elif [[ "$machine" == *"86" ]]; then
    platform='netbsd-386'
  fi
fi

if test "x$platform" = "x"; then
  cat <<EOM
/=====================================\\
|      COULD NOT DETECT PLATFORM      |
\\=====================================/

Uh oh! We couldn't automatically detect your operating system.

To continue with installation, please choose from one of the following values:

- freebsd32
- freebsd64
- linux-arm
- linux32
- linux64
- netbsd32
- netbsd64
- openbsd32
- openbsd64
- osx
EOM
  read -rp "> " platform
else
  echo "Detected platform: $platform"
fi

TAG=$(githubLatestTag lightningnetwork/lnd)

echo "Downloading https://github.com/lightningnetwork/lnd/releases/download/v$TAG/lnd-$platform-v$TAG.tar.gz"
curl -L "https://github.com/lightningnetwork/lnd/releases/download/v$TAG/lnd-$platform-v$TAG.tar.gz" > lnd.tar.gz

dirname="lnd-$platform-v$TAG"
tar -xvzf lnd.tar.gz "$dirname"
mv "$dirname" lnd/

rm lnd.tar.gz
rm -rf "$dirname"

cat <<-'EOM'

LND (Lightning Network Daemon) and LNCLI (Lightning Network Command Line Interface) have been downloaded to ./lnd.

You can run them with:
./lnd/lnd
./lnd/lncli

EOM


echo "Downloading preloaded blockchain data"
curl -O https://media.githubusercontent.com/media/mvanderh/pragmatic-lightning/master/lnd_data.tar
tar xvf lnd_data.tar
if [[ "$OSTYPE" == "darwin"* ]]; then
    lnddir="~/Library/Application Support/Lnd"
else
    lnddir="~/.lnd"
fi
mkdir "$lnddir"
mv lnd_data/ "$lnddir"
rm -rf lnd_data/
rm lnd_data.tar

