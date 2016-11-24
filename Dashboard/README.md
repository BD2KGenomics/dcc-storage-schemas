#Dashboard
##Introduction

The Dashboard includes the File Browser and a bar chart.

The File Browser allows the user to look at the different files available. 
This iteration of the File Browser directly queries Elasticsearch, where the metadata is stored.

##Load data into Elasticsearch
Open and run Elasticsearch 2.x
add the elasticsearch.jsonl file from this branch into elasticsearch

      curl -XPUT http://localhost:9200/analysis_file/_bulk?pretty --data-binary @elasticsearch.jsonl

check to make sure there are documents added

      curl 'localhost:9200/_cat/indices?v'
   
##Locally run the Dashboard
Create a local host

      python -m SimpleHTTPServer 8080

Open index.html on a web browser, click on File Browser
If results are not showing, be sure to allow CORS (cross-origin-resource-sharing)
