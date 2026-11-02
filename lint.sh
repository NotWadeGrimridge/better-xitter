#!/bin/bash

set -ex

deno task check
deno task lint
deno fmt src/ scripts/ .oxlintrc.json
