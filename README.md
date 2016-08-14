# dcc-storage-schemas

## Introduction

This repo contains several items relate to metadata JSONs used to describe biospecimen and analysis events for the core.

First, there are JSON schema, see `analysis_flattened.json` and `biospecimen_flattened.json`.

Second, this repo contains a `generate_metadata.py` script that takes a TSV format and converts it into metadata JSON documents (and also has an option for uploading, we use this for bulk uploads to our system).

This repo also contains a merge tool, `merge_gen_meta.py`, responsible for creating Donor centric JSON documents suitable for loading in Elasticsearch.  In the long run the idea is to use this tool to do the following:

1. query the storage system for all metadata.json
1. group the related metadata.json documents, all the docs for a given donor are grouped together
1. use the parent information in each document to understand where in the donor document the sub-documents should be merged
1. call the merge tool with sub-json documents, generate a per-donor JSON document that's suitable for loading in Elasticsearch (this includes adding various "flags" that make queries easier).
1. load in Elasticsearch, perform queries

## Install

### Ubuntu 14.04

You need to make sure you have system level dependencies installed in the appropriate way for your OS.  For Ubuntu 14.04 you do:

    sudo apt-get install python-dev libxml2-dev libxslt-dev lib32z1-dev

### Elasticsearch

Download and install elasticsearch.  I found the debian package to be easiest on Ubuntu.  Start it using the /etc/init.d/elasticsearch script. Or, if you're on a mac, you can download a tarball and just execute the ./bin/elasticsearch script.

Use [elasticsearch 1.7.2](https://www.elastic.co/downloads/past-releases/elasticsearch-1-7-2).  Newer (2.x) versions will
work for our indexing but our facet file browser requires an older version of elasticsearch.

NOTE: elasticsearch is not secure. Do not run it on a web server open to the outside world.

### Python

Use python 2.7.x.

See [here](https://www.dabapps.com/blog/introduction-to-pip-and-virtualenv-python/) for information on setting
up a virtual environment for Python.

If you haven't already installed pip and virtualenv, depending on your system you may
(or may not) need to use `sudo` for these:

    sudo easy_install pip
    sudo pip install virtualenv

Now to setup:

    virtualenv env
    source env/bin/activate
    pip install jsonschema jsonmerge openpyxl sets json-spec elasticsearch semver luigi python-dateutil cwl-runner cwltool==1.0.20160316150250 schema-salad==1.7.20160316150109 avro==1.7.7 typing

Alternatively, you may want to use Conda, see [here](http://conda.pydata.org/docs/_downloads/conda-pip-virtualenv-translator.html)
 [here](http://conda.pydata.org/docs/test-drive.html), and [here](http://kylepurdon.com/blog/using-continuum-analytics-conda-as-a-replacement-for-virtualenv-pyenv-and-more.html)
 for more information.

    conda create -n schemas-project python=2.7.11
    source activate schemas-project
    pip install jsonschema jsonmerge openpyxl sets json-spec elasticsearch semver luigi python-dateutil cwl-runner cwltool==1.0.20160316150250 schema-salad==1.7.20160316150109 avro==1.7.7 typing


## Generate Test Metadata (and Optionally Upload Data to Storage Service)

We need to create a bunch of JSON documents for multiple donors and multiple
experimental designs and file upload types.  To do that we (Chris) developed a very simple
TSV to JSON tool and this will ultimately form the basis of our helper applications
that clients will use in the field to prepare their samples.

    python generate_metadata.py \
		--input-metadata-schema input_metadata.json \
		--metadata-schema metadata_schema.json \
		--output-dir output_metadata \
		--receipt-file receipt.tsv \
		--storage-access-token `cat ucsc-storage-client/accessToken` \
		--skip-upload \
		sample_tsv/sample.tsv

  - `input_metadata.json` is a json schema used to do a very basic validation on input data.
  - `metadata_schema.json` is a json schema used to validate output metadata.json files.
  - `output_metadata` is the directory where the metadata files will be written.
  - `receipt.tsv` is the upload confirmation file where assigned UUIDs are recorded. Find it in `output_metadata` after a successful upload.

Take out `--skip-upload` if you want to perform upload, see below for more details.

In case there are already existing bundle ID's that cause a collision on the S3 storage, you can specify the `--force-upload` switch to replace colliding bundle ID's with the current uploading version.

Now look in the `output_metadata` directory for per-bundle directories that contain metadata files for each analysis workflow.

### Enabling Upload

By default the upload won't take place if the directory `ucsc-storage-client` is not present in the `dcc-storage-schema`
directory.  In order to get the client, you need to be given the tarball since it contains sensitive
information and an access key.  See our private [S3 bucket](https://s3-us-west-2.amazonaws.com/beni-dcc-storage-dev/ucsc-storage-client.tar.gz)
for the tarball.

If you have the directory setup and don't pass in `--skip-upload` the upload will take place.  Keep this in
mind if you're just testing the metadata components and don't want to create a ton of uploads.  If you upload
the fact data linked to from the `sample.tsv` the program and project will both be TEST which should make
it easy to avoid in the future. The file is based on [this](https://docs.google.com/spreadsheets/d/13fqil92C-Evi-4cy_GTnzNMmrD0ssuSCx3-cveZ4k70/edit?usp=sharing) google doc.

## Run Merge and Generate Elasticsearch Index

This tool takes multiple JSON files (see above) and merges them so we can have a donor-oriented single JSON document suitable for indexing in Elasticsearch.  It takes a list of directories that contain *.json files.  This command will read and download the json files from the endpoint. In addition to creating a `validated.jsonl` file it will also create a `endpoint_metadata/` directory that contains all of the json files that were downloaded.

    python merge_gen_meta.py --only_Program TEST --only_Project TEST --awsAccessToken `cat ucsc-storage-client/accessToken`  --clientPath ucsc-storage-client/ --metadataSchema metadata_schema.json

This command will not download json files, instead the user will provide a directory that contains json files.

    python merge_gen_meta.py --only_Program TEST --only_Project TEST --test_directory output_metadata_7_20/ --metadataSchema metadata_schema.json

This produces a `validated.jsonl` and a `invalid.jsonl` file which is actually a JSONL file, e.g. each line is a JSON document.
Now to view the output for the first line use the following:

    cat validated.jsonl | head -1 | json_pp | less -S

You can also examine this in Chrome using the JSONView extension.  Make sure you select
the option to allow viewing of local JSON files before you attempt to load this
file in Chrome.  The commands below will display the second JSON document. On a Mac:

    cat validated.jsonl | head -2 | tail -1 | json_pp > temp.json
    open -a Google\ Chrome temp.json

## Load and Query Elasticsearch

In the query_on_merge folder, you will find a queryable document, compact_single.json and a sample query, jquery1.
Start by running Elasticsearch, then to add the compact_single.json to your node by

    curl -XPUT http://localhost:9200/analysis_index/_bulk?pretty --data-binary @elasticsearch.jsonl

Then check to see if index has been created. (Should have five documents).

    curl 'localhost:9200/_cat/indices?v'

Query everything.

    curl -XGET http://localhost:9200/analysis_index/_search?pretty

And query.

    curl -XPOST http://localhost:9200/analysis_index/_search?pretty -d @query_on_merge/jquery1

Since merge.py now adds flags, you can find a queryable document, mergeflag.json and sample queries, jqueryflag. Add this document in the same fashion to a new index. Then query with:

    curl -XPOST http://localhost:9200/analysis_index/_search?pretty -d @query_on_merge/jqueryflag

However, the problem with this method is that only the first query is performed.

esquery.py can perform all of the queries (elasticsearch needs to be installed. pip install elasticsearch). Run using:

    python esquery.py

If running esquery.py multiple times, remove the index with:

    curl -XDELETE http://localhost:9200/analysis_index

## Dashboard

dashboard_query.py (in the Dashboard directory) will create an outfile called data.json. Add data.json along with the contents of the folder "Dashboard" to an AWS bucket and configure bucket according to the [AWS instructions on hosting a static website (steps 1, 2, and 3)] (http://docs.aws.amazon.com/gettingstarted/latest/swh/getting-started-create-bucket.html).

To see the Dashboard, from your bucket, go to Properties, Static Website Hosting, and click on the link following "Endpoint." This directs you to index.html, with a static streamgraph (uses data.csv). Using the navigation, hover over Projects, then click Project 1 to see a bar chart using data.json.

Alternatively, run the Dashboard locally. Add data.json to the Dashboard folder, start the python web server (see command below), and open http://localhost:8080 in your web browser:

    python -m SimpleHTTPServer 8080

## Demo

Goal: create sample single donor documents and perform queries on them.

1. Install the needed packages as described above.
1. Generate metadata for multiple donors using `generate_metadata.py`, see command above
1. Create single donor documents using `merge_gen_meta.py`, see command above
1. Load into ES index, see `curl -XPUT` command above
1. Run the queries using `esquery.py`, see command above
1. Optionally, deleted the index using the `curl -XDELETE` command above

The query script, `esquery.py`, produces output whose first line prints the number of documents searched upon.
The next few lines are center, program and project.
Following those lines, are the queries, which give information on:
* specifications of the query
* number of documents that fit the query
* number of documents that fit this query for a particular program
* project name

### services

Make sure both luigi and elasticsearch are running in screen sessions.

    # screen session 1
    ~/elasticsearch-2.3.5/bin/elasticsearch &
    # screen session 2
    source env/bin/activate
    luigid

### simulate_upload.py

This script runs an unlimited number of BAM file uploads at random intervals.  The script will run until killed.

    cd luigi_task_executor
    python simulate_upload.py --bam-url https://s3.amazonaws.com/oconnor-test-bucket/sample-data/NA12878.chrom20.ILLUMINA.bwa.CEU.low_coverage.20121211.bam \
    --input-metadata-schema ../input_metadata.json --metadata-schema ../metadata_schema.json --output-dir output_metadata --receipt-file receipt.tsv \
    --storage-access-token `cat ../ucsc-storage2-client/accessToken` --metadata-server-url https://storage2.ucsc-cgl.org:8444 \
    --storage-server-url https://storage2.ucsc-cgl.org:5431  --ucsc-storage-client-path ../ucsc-storage2-client

### simulate_indexing.py

    cd luigi_task_executor
    python simulate_indexing.py --storage-access-token `cat ../ucsc-storage2-client/accessToken` --client-path ../ucsc-storage2-client --metadata-schema ../metadata_schema.json --server-host storage2.ucsc-cgl.org

### simulate_analysis.py

    cd luigi_task_executor
    python simulate_analysis.py --es-index-host localhost --es-index-port 9200 --ucsc-storage-client-path ../ucsc-storage2-client --ucsc-storage-host https://storage2.ucsc-cgl.org

    # temp
    git hf update; git hf pull; PYTHONPATH='' luigi --module AlignmentQCTask AlignmentQCCoordinator --es-index-host localhost --es-index-port 9200 --ucsc-storage-client-path ../ucsc-storage2-client --ucsc-storage-host https://storage2.ucsc-cgl.org --tmp-dir `pwd`/luigi_state --data-dir /mnt/AlignmentQCTask --max-jobs 1

### populate dashboard

    cd Dashboard
    python dashboard_query.py

## Data Types

We support the following types.  First and foremost, the types below are just intended
to be an overview. We need to standardize on actual acceptable terms. To do this
we use the Codelists (controlled vocabularies) from the ICGC.  See http://docs.icgc.org/dictionary/viewer/#?viewMode=codelist

In the future we will validate metadata JSON against these codelists.

### Sample Types:

* dna normal
* dna tumor
* rna tumor
* rna normal (rare)

And there are others as well but these are the major ones we'll encounter for now.

The actual values should come from the ICGC Codelist above.  Specifically the
`specimen.0.specimen_type.v3` codelist.

### Experimental Design Types

* WXS
* WGS
* Gene Panel
* RNAseq

The actual values should come from the ICGC Codelist above.  Specifically the
`GLOBAL.0.sequencing_strategy.v1` codelist.

### File Types/Formats

* sequence/fastq
* sequence/unaligned BAM
* alignment/BAM & BAI pair
* expression/RSEM(?)
* variants/VCF

These will all come from the [EDAM Ontology](http://edamontology.org).  They have
a mechanism to add terms as needed.

### Analysis Types

* germline_variant_calling -> normal specimen level
* rna_quantification (and various other RNASeq-based analysis) -> tumor specimen level
* somatic_variant_calling -> tumor specimen level (or donor if called simultaneously for multiple tumors)
* immuno_target_pipelines -> tumor specimen level

Unfortunately, the CVs from ICGC don't cover the above, see [here](http://docs.icgc.org/dictionary/viewer/#?viewMode=table).
Look for items like `variation_calling_algorithm` and you'll see they are actually just
TEXT with a regular expression to validate them.

Take home, I think we use our own CV for these terms and expand it over time here.

I think we also need to support tagging with multiple EDAM terms as well which can,
together, describe what I'm trying to capture above.  For example:

germline_variant_calling could be:

* [Variant calling](http://edamontology.org/operation_3227): http://edamontology.org/operation_3227

Which isn't very specific and the description sounds closer to somatic calling.

So this argues that we should actually just come up with our own specific terms
used for the institute since we aren't attempting to capture the whole world's
possible use cases here.

Over time I think this will expand.  Each are targeted at a distinct biospecimen "level".
This will need to be incorporated into changes to the index builder.

## TODO

* need to add upload to Chris' script
* need to download all the metadata from the storage service
* use the above two to show end-to-end process, develop very simple cgi script to display table
* each workflow JSON needs a timestamp
* command line tool would merge the docs, taking the "level" at which each document will be merged in at
    * donor, sample, specimen

In the future, look at adding options here for specifying where files should be merged:

    python merge.py --sample alignment:alignment1.json --sample alignment:alignment2.json --donor somatic_variant_calling:somatic.json
