# Invocation example:
# replace.sh -r "ws://localhost" -a "wss://prod.com" -f "client.js"
while getopts r:a:f: flag
do
  case "${flag}" in
    r) replacement=${OPTARG};;
    a) addres=${OPTARG};;
    f) filename=${OPTARG};;
  esac
done
if [[ -z $addres ]] || [[ -z $filename ]] || [[ -z $replacement ]]; then
  echo "ERROR! Not enough flag-arguments! Flag-arguments that must be set: -r (string to be replaced), -a (string to replace), -f (filename)"
  exit 1
else
  sed -i "s+$replacement+$addres+g" $filename
fi