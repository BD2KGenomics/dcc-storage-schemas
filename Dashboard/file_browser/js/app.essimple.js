'use strict';

// We define an EsConnector module that depends on the elasticsearch module.     
var EsConnector = angular.module('EsConnector', ['elasticsearch']);

// Create the es service from the esFactory
EsConnector.service('es', function (esFactory) {
   return esFactory({ host: 'localhost:9200' });
});

// We define an Angular controller that returns the server health
// Inputs: $scope and the 'es' service

// EsConnector.controller('ServerHealthController', function($scope, es) {
// 
//     es.cluster.health(function (err, resp) {
//         if (err) {
//             $scope.data = err.message;
//         } else {
//             $scope.data = resp;
//         }
//     });
// });

// We define an Angular controller that returns query results,
// Inputs: $scope and the 'es' service

EsConnector.controller('QueryController', function($scope, es, $compile) { 
   //deals with checkboxes and length of filter (in addFilter)
   var checkFilters = [];
   
   //holds the query
   var queryholder = [];
   
   //holds the specific query
   var mustMatchFilters = [];
   var shouldMatchFilters = [];
   
   //all the facets should be simplified... way too much repetitive code.
   var center_nameFacet = ["center_name"];
   var programFacet = ["program"];
   var projectFacet = ["project"];
   var workflowFacet = ["workflow"];
   var analysis_typeFacet = ["analysis_type"];
   var specimen_typeFacet = ["specimen_type"];
   var file_typeFacet = ["file_type"];
   
   //page count
   $scope.offset = 0;

   //total number of hits at any time
   var numHits =100;
   
   //for manifest download
   var bodyStr =[];
   
   //for pie chart
   var pieArrAnalysis = [];
   var pieArrWorkflow = [];
   var pieArrFile = [];
   
   //{center_name: "Stanford"}, { center_name : "UCSC" }, { donor_uuid : "dc123cfd-6e09-5635-b81f-bce781244892" }
   

   //adds filter to query
   var addFilter = function(){
      if (checkFilters.length == 0){
         queryholder = {match_all:{}}
      }
      else{
         matchCreator();
         queryholder = {
            bool: {
               must : mustMatchFilters,
               should : shouldMatchFilters//{term : {"center_name": "UCSC"}, term: {center_name: "Stanford"}}
            }
         }
      }
   }
   
   //helper function for addFilter. AND(must) between facets. OR(should) within facets.
   var matchCreator = function(){
      mustMatchFilters = [];
      shouldMatchFilters = [];
      
      //center_name
      if (center_nameFacet.length>2){
         for (var i = 1; i < center_nameFacet.length; i++){
            shouldMatchFilters.push({match: center_nameFacet[i]});
         }
      }
      else if (center_nameFacet.length==2){
         mustMatchFilters.push({match: center_nameFacet[1]});
      }
      //program
      if (programFacet.length>2){
         for (var i = 1; i < programFacet.length; i++){
            shouldMatchFilters.push({match: programFacet[i]});
         }
      }
      else if (programFacet.length==2){
         mustMatchFilters.push({match: programFacet[1]});
      }
      //project
      if (projectFacet.length>2){
         for (var i = 1; i < projectFacet.length; i++){
            shouldMatchFilters.push({match: projectFacet[i]});
         }
      }
      else if (projectFacet.length==2){
         mustMatchFilters.push({match: projectFacet[1]});
      }
      //workflow
      if (workflowFacet.length>2){
         for (var i = 1; i < workflowFacet.length; i++){
            shouldMatchFilters.push({match: workflowFacet[i]});
         }
      }
      else if (workflowFacet.length==2){
         mustMatchFilters.push({match: workflowFacet[1]});
      }
      //analysis_type
      if (analysis_typeFacet.length>2){
         for (var i = 1; i < analysis_typeFacet.length; i++){
            shouldMatchFilters.push({match: analysis_typeFacet[i]});
         }
      }
      else if (analysis_typeFacet.length==2){
         mustMatchFilters.push({match: analysis_typeFacet[1]});
      }
      //specimen_type
      if (specimen_typeFacet.length>2){
         for (var i = 1; i < specimen_typeFacet.length; i++){
            shouldMatchFilters.push({match: specimen_typeFacet[i]});
         }
      }
      else if (specimen_typeFacet.length==2){
         mustMatchFilters.push({match: specimen_typeFacet[1]});
      }
      //file_type
      if (file_typeFacet.length>2){
         for (var i = 1; i < file_typeFacet.length; i++){
            shouldMatchFilters.push({match: file_typeFacet[i]});
         }
      }
      else if (file_typeFacet.length==2){
         mustMatchFilters.push({match: file_typeFacet[1]});
      }
      //console.log(mustMatchFilters);
      //console.log(shouldMatchFilters);
   }
   
   
   //for paging, refresh chart on 
   $scope.refresh = function(pcount){
      $scope.offset = $scope.offset+pcount;
      console.log($scope.offset);
      if($scope.offset === 0){
         $scope.back = "";
         $scope.poutof = "";
         $scope.of = "";
      }
      else{
         $scope.back = "Back";
         $scope.poutof = Math.ceil((numHits)/10);
         $scope.of = "of";
      }
      if(($scope.offset*10)+10 >= numHits){
         $scope.next = "";
      }
      else{
         $scope.next = "Next";
      }
      $scope.search(10);
   }

   var count = 0;
   $scope.search = function(numSize) {
      count += 1;
      addFilter();
      // search for documents
      es.search({
         index: 'analysis_file_index',
         size: numSize,
         from: ($scope.offset*10),
         body: {
            //these are the sidebar checkboxes
            "aggs": {
               "center_name": {
                  "terms": {
                     "field": "center_name",
                     "min_doc_count" : 0,
                  }
               },
               "program": {
                  "terms": {
                     "field": "program",
                     "min_doc_count" : 0
                  }
               },
               "project": {
                  "terms": {
                     "field": "project",
                     "min_doc_count" : 0
                  }
               },
               "workflow": {
                  "terms": {
                     "field": "workflow",
                     "min_doc_count" : 0
                  }
               },
               "analysis_type": {
                  "terms": {
                     "field": "analysis_type",
                     "min_doc_count" : 0
                  }
               },
               "specimen_type": {
                  "terms": {
                     "field": "specimen_type",
                     "min_doc_count" : 0
                  }
               },
               "file_type": {
                  "terms": {
                     "field": "file_type",
                     "min_doc_count" : 0
                  }
               }
            },
            
            //and this is the query
            query: queryholder
         }


      }).then(function (response) {
         $scope.hits = response.hits.hits;
         $scope.results = response.aggregations;
         numHits = response.hits.total;
         console.log($scope.hits);
         
         //redraw pie charts after every search
         drawAnalysisChart();
         drawWorkflowChart();
         drawFileChart();
      });
   }
   $scope.refresh(0);

   //makes the checkboxes stay checked
   $scope.hasCheck = function(facet, item){
      if (checkFilters.indexOf(facet+item) >= 0){
         return true;
      }
      else {
         return false;
      } 
      $scope.search(10);
   }
   
   //compares objects
   function arrayObjectIndexOf(arr, obj){
      for(var i = 0; i < arr.length; i++){
         if(angular.equals(arr[i], obj)){
            return i;
         }
      };
      return -1;
   }
   
   //adds filter to elasticsearch if checkbox is checked
   $scope.checking = function(facet, item){
      var template = '{"'+facet+'":"'+item+'"}'
      var filterTemp = angular.fromJson(template);
      if (checkFilters.indexOf(facet+item) === -1){
         if (facet == center_nameFacet[0]){
            center_nameFacet.push(filterTemp);
         }
         if (facet == programFacet[0]){
            programFacet.push(filterTemp);
         }
         if (facet == projectFacet[0]){
            projectFacet.push(filterTemp);
         }
         if (facet == workflowFacet[0]){
            workflowFacet.push(filterTemp);
         }
         if (facet == analysis_typeFacet[0]){
            analysis_typeFacet.push(filterTemp);
         }
         if (facet == specimen_typeFacet[0]){
            specimen_typeFacet.push(filterTemp);
         }
         if (facet == file_typeFacet[0]){
            file_typeFacet.push(filterTemp);
         }
         checkFilters.push(facet+item);
      }
      else{
         checkFilters.splice(checkFilters.indexOf(facet+item), 1);
         if (facet == center_nameFacet[0]){
            center_nameFacet.splice(arrayObjectIndexOf(center_nameFacet, filterTemp), 1);
         }
         if (facet == programFacet[0]){
            programFacet.splice(arrayObjectIndexOf(programFacet, filterTemp), 1);
         }
         if (facet == projectFacet[0]){
            projectFacet.splice(arrayObjectIndexOf(projectFacet, filterTemp), 1);
         }
         if (facet == workflowFacet[0]){
            workflowFacet.splice(arrayObjectIndexOf(workflowFacet, filterTemp), 1);
         }
         if (facet == analysis_typeFacet[0]){
            analysis_typeFacet.splice(arrayObjectIndexOf(analysis_typeFacet, filterTemp), 1);
         }
         if (facet == specimen_typeFacet[0]){
            specimen_typeFacet.splice(arrayObjectIndexOf(specimen_typeFacet, filterTemp), 1);
         }
         if (facet == file_typeFacet[0]){
            file_typeFacet.splice(arrayObjectIndexOf(file_typeFacet, filterTemp), 1);
         }
      }
      $scope.offset = 0;
      $scope.refresh(0);
   }
      
   //download as manifest
   var titledown = "Project\tDonor\tSpecimen\tType\tAnalysis Type\tWorkflow\tFile Type\tFile\tDownload ID"
   $scope.downloadfile = function(){
      $scope.search(numHits);
      $scope.offset = 0;
      $scope.search(numHits);
      bodydown();
      var file = new File([titledown+"\n"+bodyStr], "results.tsv", {type: "text/plain;charset=utf-8"});
      saveAs(file);
   }
   
   //download as manifest helper function
   var bodydown = function(){
      console.log("resultsArr ");
      console.log($scope.resultsArr);
      $scope.bodyArr = [];
      for (var i=0; i<numHits; i++){
         var projectDown = $scope.hits[i]['_source']['project'];
         var donorDown = $scope.hits[i]['_source']['donor'];
         var specimen_typeDown = $scope.hits[i]['_source']['specimen_type'];
         var analysis_typeDown = $scope.hits[i]['_source']['analysis_type'];
         var workflowDown = $scope.hits[i]['_source']['workflow'];
         var file_typeDown = $scope.hits[i]['_source']['file_type'];
         var titleDown = $scope.hits[i]['_source']['title'];
         var download_idDown = $scope.hits[i]['_source']['download_id'];
         $scope.bodyArr.push(projectDown+"\t"+donorDown+"\t"+specimen_typeDown+"\t"+analysis_typeDown+"\t"+workflowDown+"\t"+file_typeDown+"\t"+titleDown+"\t"+download_idDown);
      }
      bodyStr = $scope.bodyArr[0];
      for (var i=1;i<numHits;i++){
         bodyStr = bodyStr.concat("\n");
         bodyStr = bodyStr.concat($scope.bodyArr[i]);
      }
   }
   
   // turns pie data into array format
   $scope.piedata = function(pienum){
      pieArrAnalysis =[];
      var pieTemp = [];
      var pieTemp2 = [];
      console.log($scope.results)
      for (var i=0; i<$scope.results.analysis_type.buckets.length; i++){
         pieTemp = [];
         pieTemp.push($scope.results.analysis_type.buckets[i].key);
         pieTemp.push($scope.results.analysis_type.buckets[i].doc_count);
         pieTemp2.push(pieTemp);
      }
      for (var i=0; i<$scope.results.analysis_type.buckets.length; i++){
         pieArrAnalysis.push(pieTemp2[i]);
      }
      pieArrWorkflow =[];
      pieTemp2 = [];
      for (var i=0; i<$scope.results.workflow.buckets.length; i++){
         pieTemp = [];
         pieTemp.push($scope.results.workflow.buckets[i].key);
         pieTemp.push($scope.results.workflow.buckets[i].doc_count);
         pieTemp2.push(pieTemp);
      }
      for (var i=0; i<$scope.results.workflow.buckets.length; i++){
         pieArrWorkflow.push(pieTemp2[i]);
      }
      pieArrFile =[];
      pieTemp2 = [];
      for (var i=0; i<$scope.results.file_type.buckets.length; i++){
         pieTemp = [];
         pieTemp.push($scope.results.file_type.buckets[i].key);
         pieTemp.push($scope.results.file_type.buckets[i].doc_count);
         pieTemp2.push(pieTemp);
      }
      for (var i=0; i<$scope.results.file_type.buckets.length; i++){
         pieArrFile.push(pieTemp2[i]);
      }
   }
   
   //pie chart maker
   var chart;
   google.charts.load('current', {'packages':['corechart']});
   google.charts.setOnLoadCallback(drawAnalysisChart);
   function drawAnalysisChart() {
      $scope.piedata(numHits);
      var data = new google.visualization.DataTable();
      data.addColumn('string', 'Type');
      data.addColumn('number', 'Number');
      data.addRows(pieArrAnalysis);

      var options = {
         title: 'Analysis Type',
         width: 425,
         height: 300
      };

      chart = new google.visualization.PieChart(document.getElementById('piechartAnalysis'));

      chart.draw(data, options);
   }      
   google.charts.setOnLoadCallback(drawWorkflowChart);
   function drawWorkflowChart() {
      $scope.piedata(numHits);
      var data = new google.visualization.DataTable();
      data.addColumn('string', 'Type');
      data.addColumn('number', 'Number');
      data.addRows(pieArrWorkflow);
      
      var options = {
         title: 'Workflow Type',
         width: 425,
         height: 300
      };

      chart = new google.visualization.PieChart(document.getElementById('piechartWorkflow'));

      chart.draw(data, options);
   }    
   google.charts.setOnLoadCallback(drawFileChart);
   function drawFileChart() {
      $scope.piedata(numHits);
      var data = new google.visualization.DataTable();
      data.addColumn('string', 'Type');
      data.addColumn('number', 'Number');
      data.addRows(pieArrFile);
      
      var options = {
         title: 'File Type',
         width: 425,
         height: 300
      };

      chart = new google.visualization.PieChart(document.getElementById('piechartFile'));

      chart.draw(data, options);
   }   
});

//to do: Get manifest to download without showing all the results.
//add to GitHub!!! tag with something
