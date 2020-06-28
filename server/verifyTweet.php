<?php

include 'secrets.php';

$fingerprint = htmlspecialchars($_GET["fp"]);
$tweetId = htmlspecialchars($_GET["id"]);

$check = "\[Verifying my OpenPGP key: openpgp4fpr:$fingerprint\]";

$ch = curl_init();
curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-Type: application/json', $twitter_api_auth));
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "GET");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_URL, "https://api.twitter.com/labs/2/tweets/$tweetId?tweet.fields=author_id,created_at,id,source,text");
$result = curl_exec($ch);
curl_close($ch);
$data = json_decode($result, true);

$response = array();
$response["verified"] = false;
$response["fingerprint"] = $fingerprint;
$response["tweetId"] = $tweetId;
$response["text"] = $data["data"]["text"];

if (preg_match("/{$check}/i", $data["data"]["text"])) {
    $response["verified"] = true;
}
echo json_encode($response);

?>
