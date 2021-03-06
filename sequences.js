// Dimensions of sunburst.
var width = 750;
var height = 600;
var radius = Math.min(width, height) / 2;

// Breadcrumb dimensions: width, height, spacing, width of tip/tail.
var b = {
    w: 75, h: 30, s: 3, t: 10
};

// Length of the name in the breadcrumb
var breadcrumbLength = 0;
var allBreadCrumbLengths = [];
var allNameLengths = [];

// Mapping of steps to a cycle of colors.
var colors = d3.scale.category10();

// Total size of all segments; we set this later, after loading the data.
var totalSize = 0;
var colorSelect = 0;

var vis = d3.select("#chart").append("svg:svg")
    .attr("width", width)
    .attr("height", height)
    .append("svg:g")
    .attr("id", "container")
    .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

var partition = d3.layout.partition()
    .size([2 * Math.PI, radius * radius])
    .value(function (d) { return d.size; });

var arc = d3.svg.arc()
    .startAngle(function (d) { return d.x; })
    .endAngle(function (d) { return d.x + d.dx; })
    .innerRadius(function (d) { return Math.sqrt(d.y); })
    .outerRadius(function (d) { return Math.sqrt(d.y + d.dy); });
//Lisa 4/9/17
 d3.text("FeedGrains.csv", function (text) {
     //console.log("In mah function");
     var origData = d3.csv.parseRows(text);

     	//JT 4/23/17
     	//assume the following column values can be injected by a GUI
     	var indicesOfInterest = [3, 8, 6, 1];
	//replace existing hyphens with underscores
	//and make blank cells say "(blank)"
	for (i = 0; i < origData.length; i++){
		for (j = 0; j < indicesOfInterest.length; j++){
			var z = indicesOfInterest[j];  
			if(origData[i][z].length==0){
				origData[i][z] = "(blank)";
			}
			else{
				origData[i][z] = origData[i][z].replace("-","_");
			}
		}
	}

     //number of rows
     var CSVFirstCol = new Array();
     var CSVSecCol = new Array();
     for (i = 0; i < origData.length; i++) {
         var newPath = "";
         for (j=0; j < indicesOfInterest.length; j++){
            var indiceToAdd = indicesOfInterest[j];  
             if (j != indicesOfInterest.length-1)
             {
                              
                 newPath = newPath.concat(origData[i][indiceToAdd], "-");
             }
             else
             {
                 newPath = newPath.concat(origData[i][indiceToAdd]);
                 } 
         }
         var index = -1;
         if (i > 0)
          {index = CSVFirstCol.indexOf(newPath);}
         if (index > -1)
         {
             CSVSecCol[index] = CSVSecCol[index] + 1;   
         }
         else
         {
             CSVFirstCol.push(newPath);
             CSVSecCol.push(1);
         }
     }
     //console.log(CSVFirstCol);
     //console.log(CSVSecCol);
     var finalData = new Array();
     for (i = 0; i < CSVFirstCol.length; i++)
     {
         var newRow = new Array();
         newRow.push(CSVFirstCol[i]);
         newRow.push(CSVSecCol[i]);
         finalData.push(newRow);
     }
     formattedCSV = d3.csv.format(finalData);
     //console.log(formattedCSV);
     var finalCSV = d3.csv.parseRows(formattedCSV);
     var newJson = buildHierarchy(finalCSV);
     createVisualization(newJson);
 });

/*
// Use d3.text and d3.csv.parseRows so that we do not need to have a header
// row, and can receive the csv as an array of arrays.
d3.text("input.csv", function (text) {
    var csv = d3.csv.parseRows(text);
    var json = buildHierarchy(csv);
    createVisualization(json);
});
*/
function getNodeColor(d)
{
    return colors(d.name);
}

// Main function to draw and set up the visualization, once we have the data.
function createVisualization(json) {

    // Basic setup of page elements.
    initializeBreadcrumbTrail();
    drawLegend();
    d3.select("#togglelegend").on("click", toggleLegend);

    // Bounding circle underneath the sunburst, to make it easier to detect
    // when the mouse leaves the parent g.
    vis.append("svg:circle")
        .attr("r", radius)
        .style("opacity", 0);

    // For efficiency, filter nodes to keep only those large enough to see.
    var nodes = partition.nodes(json)
        .filter(function (d) {
            return (d.dx > 0.005); // 0.005 radians = 0.29 degrees
        });

    // Make the domain for the color scale
    var uniqueNames = (function(a) {
        var output = [];
        a.forEach(function(d) {
            if (output.indexOf(d.name) === -1) {
                output.push(d.name);
            }
        });
        return output;
    })(nodes);

    colors.domain(uniqueNames);

    var path = vis.data([json]).selectAll("path")
        .data(nodes)
        .enter().append("svg:path")
        .attr("display", function (d) { return d.depth ? null : "none"; })
        .attr("d", arc)
        .attr("fill-rule", "evenodd")
        .style("fill", getNodeColor)
        .style("opacity", 1)
        .on("mouseover", mouseover);

    // Add the mouseleave handler to the bounding circle.
    d3.select("#container").on("mouseleave", mouseleave);

    // Get total size of the tree = value of root node from partition.
    totalSize = path.node().__data__.value;
};

// Fade all but the current sequence, and show it in the breadcrumb trail.
function mouseover(d) {

    var percentage = (100 * d.value / totalSize).toPrecision(3);
    var percentageString = percentage + "%";
    if (percentage < 0.1) {
        percentageString = "< 0.1%";
    }

    d3.select("#percentage")
        .text(percentageString);

    d3.select("#explanation")
        .style("visibility", "");

    var sequenceArray = getAncestors(d);
    updateBreadcrumbs(sequenceArray, percentageString);

    // Fade all the segments.
    d3.selectAll("path")
        .style("opacity", 0.3);

    // Then highlight only those that are an ancestor of the current segment.
    vis.selectAll("path")
        .filter(function (node) {
            return (sequenceArray.indexOf(node) >= 0);
        })
        .style("opacity", 1);
}

// Restore everything to full opacity when moving off the visualization.
function mouseleave(d) {

    // Hide the breadcrumb trail
    d3.select("#trail")
        .style("visibility", "hidden");

    // Deactivate all segments during transition.
    d3.selectAll("path").on("mouseover", null);

    // Transition each segment to full opacity and then reactivate it.
    d3.selectAll("path")
        .transition()
        .duration(1000)
        .style("opacity", 1)
        .each("end", function () {
            d3.select(this).on("mouseover", mouseover);
        });

    d3.select("#explanation")
        .style("visibility", "hidden");
}

// Given a node in a partition layout, return an array of all of its ancestor
// nodes, highest first, but excluding the root.
function getAncestors(node) {
    var path = [];
    var current = node;
    while (current.parent) {
        path.unshift(current);
        current = current.parent;
    }
    return path;
}

function initializeBreadcrumbTrail() {
    // Add the svg area.
    var trail = d3.select("#sequence").append("svg:svg")
        .attr("width", width)
        .attr("height", 50)
        .attr("id", "trail");
    // Add the label at the end, for the percentage.
    trail.append("svg:text")
      .attr("id", "endlabel")
      .style("fill", "#000");
}

// Generate a string that describes the points of a breadcrumb polygon.
function breadcrumbPoints(d, i) {
	var points = [];
	if (allNameLengths[i] > 6)
	{
		b.w = 75 + (3 + (allNameLengths[i]/18))*allNameLengths[i];
		points.push("0,0");
		points.push(b.w + ",0");
		points.push(b.w + b.t + "," + (b.h / 2));
		points.push(b.w + "," + b.h);
		points.push("0," + b.h);
		if (i > 0) { // Leftmost breadcrumb; don't include 6th vertex.
			points.push(b.t + "," + (b.h / 2));
		}
	}
	else
	{
		b.w = 75;
		points.push("0,0");
		points.push(b.w + ",0");
		points.push(b.w + b.t + "," + (b.h / 2));
		points.push(b.w + "," + b.h);
		points.push("0," + b.h);
		if (i > 0) { // Leftmost breadcrumb; don't include 6th vertex.
			points.push(b.t + "," + (b.h / 2));
		}
	}
    
    
    return points.join(" ");
}

function breadcrumbTextLocation(d,i) {
    return  ((allBreadCrumbLengths[i] + b.t) / 2);
}

// Update the breadcrumb trail to show the current sequence and percentage.
function updateBreadcrumbs(nodeArray, percentageString) {

    // Data join; key function combines name and depth (= position in sequence).
    var g = d3.select("#trail")
        .selectAll("g")
        .data(nodeArray, function (d) { return d.name + d.depth; });

    // Add breadcrumb and label for entering nodes.
    var entering = g.enter().append("svg:g");
	
	entering.append("svg:text")
		.text(function (d) { return d.name; })
        .select(function(d,i) {
            if(this.__data__.name.length > 6) {
                allBreadCrumbLengths[i] = b.w + (3 + (this.__data__.name.length/18))*this.__data__.name.length;
            }
            else {
                allBreadCrumbLengths[i] = b.w;
            }
            allNameLengths[i] = this.__data__.name.length;
		});
	
	entering.append("svg:polygon")
        .attr("points", breadcrumbPoints)
        .style("fill", getNodeColor);
		
	entering.append("svg:text")
        .attr("x", breadcrumbTextLocation)
        .attr("y", b.h / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle")
        .text(function (d) { return d.name; });

    breadcrumbLength = 0;

    // Set position for entering and updating nodes.
    g.attr("transform", function(d, i) {
        var breadCrumbStartPoint = 0;
        breadcrumbLength += allBreadCrumbLengths[i] + b.s;
        if (i == 0)
        {
            return "translate(" + breadCrumbStartPoint + ", 0)";
        }
        else
        {
            for (var j = 0; j < i; j++)
            {
                breadCrumbStartPoint += allBreadCrumbLengths[j] + b.s;
            }
            return "translate(" + breadCrumbStartPoint + ", 0)";
        }
    });

    // Remove exiting nodes.
    g.exit().remove();

    // Now move and update the percentage at the end.
    d3.select("#trail").select("#endlabel")
        .attr("x", (breadcrumbLength + 3*b.s + 3*b.t))
        .attr("y", b.h / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle")
        .text(percentageString);

    // Make the breadcrumb trail visible, if it's hidden.
    d3.select("#trail")
        .style("visibility", "");

    // Reset b.w to default
    b.w = 75;
}

function drawLegend() {

    // Dimensions of legend item: width, height, spacing, radius of rounded rect.
    var li = {
        w: 75, h: 30, s: 3, r: 3
    };

    var legend = d3.select("#legend").append("svg:svg")
        .attr("width", li.w)
        .attr("height", d3.keys(colors).length * (li.h + li.s));

    var g = legend.selectAll("g")
        .data(d3.entries(colors))
        .enter().append("svg:g")
        .attr("transform", function (d, i) {
            return "translate(0," + i * (li.h + li.s) + ")";
        });

    g.append("svg:rect")
        .attr("rx", li.r)
        .attr("ry", li.r)
        .attr("width", li.w)
        .attr("height", li.h)
        .style("fill", function (d) { return d.value; });

    g.append("svg:text")
        .attr("x", li.w / 2)
        .attr("y", li.h / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle")
        .text(function (d) { return d.key; });
}

function toggleLegend() {
    var legend = d3.select("#legend");
    if (legend.style("visibility") == "hidden") {
        legend.style("visibility", "");
    } else {
        legend.style("visibility", "hidden");
    }
}

// Take a 2-column CSV and transform it into a hierarchical structure suitable
// for a partition layout. The first column is a sequence of step names, from
// root to leaf, separated by hyphens. The second column is a count of how 
// often that sequence occurred.
function buildHierarchy(csv) {
    var root = { "name": "root", "children": [] };
    for (var i = 0; i < csv.length; i++) {
        var sequence = csv[i][0];
        var size = +csv[i][1];
        if (isNaN(size)) { // e.g. if this is a header row
            continue;
        }
        var parts = sequence.split("-");
        var currentNode = root;
        for (var j = 0; j < parts.length; j++) {
            var children = currentNode["children"];
            var nodeName = parts[j];
            var childNode;
            if (j + 1 < parts.length) {
                // Not yet at the end of the sequence; move down the tree.
                var foundChild = false;
                for (var k = 0; k < children.length; k++) {
                    if (children[k]["name"] == nodeName) {
                        childNode = children[k];
                        foundChild = true;
                        break;
                    }
                }
                // If we don't already have a child node for this branch, create it.
                if (!foundChild) {
                    childNode = { "name": nodeName, "children": [] };
                    children.push(childNode);
                }
                currentNode = childNode;
            } else {
                // Reached the end of the sequence; create a leaf node.
                childNode = { "name": nodeName, "size": size };
                children.push(childNode);
            }
        }
    }
    return root;
};
