#!/bin/bash

set -ex

deno check source/ scripts/
deno lint source/ scripts/
deno fmt source/ scripts/
