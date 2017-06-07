/**
 * Created by raphael on 27/04/2017.
 */
class proactiveAssistanceFollowupView {
    
    constructor(_div) {
        
        this.div = _div;
        
        // set up svg using margin conventions
        this.margin = {
            top: 15,
            right: 25,
            bottom: 40,
            left: 40
        };

        this.width = 600 - this.margin.left - this.margin.right;
        this.height = 300 - this.margin.top - this.margin.bottom;
        //this.width = document.getElementById(this.div).offsetWidth - this.margin.left - this.margin.right;
        //this.height = document.getElementById(this.div).offsetHeight - this.margin.top - this.margin.bottom;

        this.titleDiv = d3.select('#' + _div)
            .append('div')
            .attr('class', 'title');

        // add a div for action id
        this.filterDiv = d3.select('#' + _div)
            .append('div')
            .attr('id', 'filterContainer')
            .style("padding-left", "0.7em");

        this.graphicArea = d3.select("#"+_div)
            .append("svg")
            .attr("class", "viewContainer")
            .attr("width", this.width + this.margin.left + this.margin.right)
            .attr("height", this.height + this.margin.top + this.margin.bottom);


        // set up principal svg element
        this.svg = this.graphicArea
            .append("g")
            .attr("class", "restrainedArea")
            .attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");

        // define the tooltip
        this.tool_tip = d3.tip()
            .attr("class", "d3-tip")
            .offset([-8, 0]);

        // context menu
        this.tooltip = d3.select('body')
            .append('div')
            .attr('id', 'context_menu_proactive')
            .attr('class', 'hidden context_menu tooltip');

        // define the scale
        this.xScale = d3.scaleLinear()
            .range([0, this.width]);
        this.yScale = d3.scaleLinear()
            .range([this.height, 0]);

        // define the axis
        this.xAxis = d3.axisBottom(this.xScale);
        this.yAxis = d3.axisLeft(this.yScale);

        // define the line to draw the data
        this.line = d3.line();
        this.subSteps = new Map();

        this.colorScale = d3.scaleOrdinal()
            .range(['#fdff5a', '#8dd3c7','#bebada','#fb8072','#80b1d3','#fdb462','#b3de69','#fccde5','#d9d9d9','#bc80bd']);

        this.subjectData = [];
        this.allUsers = [];
        this.displayedUser = new Set();
        this.contextMenuShowing = false;

        this.noise = new Map();
    };

    //TODO: draw the proactive step in function of the response time
    draw(URL) {
        //console.log(document.getElementById(this.div).offsetHeight);
        //TODO: draw average line
        //TODO: add a div to put actio  list
        var oThis = this;

        this.titleDiv
            .style("text-align", "center")
            .append("h4")
            .text("Assistance : Guidage pas à pas");

        // initiate the tooltip
        this.tool_tip.html(function (d) {
            return "<span style='color:" + oThis.colorScale(d.subject) + "'>" + d.subject + "</span><br>"
            + "Étape : " + d["m:stepNumber"] + "<br>"
            + "Sous-étape : " + d["m:subStepNumber"] + "<br>"
            + "Nombre d'actions : " + d["m:noise"] + "<br>";
        });

        this.svg.call(this.tool_tip);

        // get the data in JSON
        var request = d3.json(URL)
            .on("beforesend", function(request) { request.withCredentials = true; })
            .mimeType("application/json");

        request.get(function (error, data) {

            if (error) throw error;

            var userNames = new Set();

            data.obsels.reduce(function (res, val) {
                oThis.noise.set(val["@id"], oThis.generateRandomNumber(-.1, .1));
                var stepNb = val["m:stepNumber"];
                var subStepNb = val["m:subStepNumber"];
                userNames.add(val.subject);
                if (!res.has(stepNb)) {
                    res.set(stepNb, subStepNb);
                }
                else {
                    if (res.get(stepNb) < subStepNb)
                        res.set(stepNb, subStepNb);
                }

                return res;

            }, oThis.subSteps);

            oThis.colorScale.domain(Array.from(userNames));

            var totalNbStep = 0;

            oThis.subSteps.forEach(function (value, key, map) {
                totalNbStep += value;
            });

            //TODO: get the action list from the trace
            // display action id list
            oThis.filterDiv
                .append("text")
                .text("Action ")
            oThis.createAndFillActionIdList(["A1"]);

            // TODO: verify the min step number
            // the min step number is 1
            oThis.xScale.domain([1, totalNbStep]);

            oThis.yScale.domain([0, d3.max(data.obsels, function (d) {
                return +d['m:noise'];
            })]);

            //TODO: display step number
            //oThis.xAxis.tickValues(data.obsels.map(function(d) { return d.end; }));
            //oThis.yAxis.tickValues(data.obsels.map(function(d) { return d["m:noise"]; }));

            oThis.yAxis.ticks(5, "d");


            // add axis
            oThis.svg.append("g")
                .attr("class", "x axis")
                .attr("transform", "translate(0," + oThis.height + ")")
                .call(oThis.xAxis)
                .append("text")
                .attr("class", "label")
                .attr("transform", "translate(" + oThis.width / 2 + ", 0)")
                .attr("y", 6)
                .attr("dy", "2.7em")
                .style("text-anchor", "middle")
                .style("fill", "black")
                .text("Étape de l'assistance");


            oThis.svg.append("g")
                .attr("class", "y axis")
                .call(oThis.yAxis)
                .append("text")
                .attr("class", "label")
                .attr("transform", "rotate(-90)")
                .attr("y", 6)
                .attr("dy", ".71em")
                .style("text-anchor", "end")
                .style("fill", "black")
                .text("Nb d'actions avant de suivre l'assistance");

            // draw the line first
            oThis.line.x(function (d) {
                return oThis.xScale(oThis.getAbsoluteStepNb(+d['m:stepNumber'], +d['m:subStepNumber']));
            })
                .y(function (d) {
                    return oThis.yScale(+d['m:noise'] + oThis.noise.get(d['@id']));
                });

            oThis.subjectData = d3.nest()
                .key(function(d) { return d.subject; })
                .entries(data.obsels);


            for (var i = 0; i < oThis.subjectData.length; i++) {
                var subject = oThis.subjectData[i].key;
                oThis.displayedUser.add(subject);
                oThis.allUsers.push(subject);
                oThis.svg.append("path")
                    .data([oThis.subjectData[i].values])
                    .attr("class", "proactiveFollowup")
                    .attr("d", oThis.line)
                    .style("fill", "none")
                    .style("stroke", function () {
                        return oThis.colorScale(subject);
                    })
                    .style("stroke-width", "2px")
                    .style("opacity", 30);

            }

            // then draw the point on top
            oThis.svg.selectAll("circle")
                .data(data.obsels)
                .enter()
                .append("circle")
                .attr("class", "point")
                .attr("cx", function(d) { return oThis.xScale(oThis.getAbsoluteStepNb(+d['m:stepNumber'], +d['m:subStepNumber'])); })
                .attr("cy", function(d) { return oThis.yScale(+d['m:noise'] + oThis.noise.get(d['@id'])); })
                .attr("r", 4.5)
                .style("fill", function (d) {
                    return oThis.colorScale(d.subject);
                })
                .style("opacity", 30)
                .on("mouseover", function (d) {
                    oThis.tool_tip.show(d);

                    d3.select(this)
                        .transition()
                        .duration(200)
                        .attr("r", 7);

                })
                .on("mouseout", function (d) {
                    d3.select(this)
                        .transition()
                        .duration(200)
                        .attr("r", 4.5);

                    oThis.tool_tip.hide(d);
                });

            // category legend
            var legend = oThis.graphicArea.selectAll(".legend")
                .data(oThis.allUsers)
                .enter().append("g")
                .attr("class", "legend")
                .attr("transform", function(d, i) { return "translate(0," + (i*15) + ")"; });

            var righMargin = 20;
            legend.append("circle")
                .attr("cx", oThis.width - righMargin - 8)
                .attr("cy", 9.3)
                .attr("r", 4)
                .attr("fill", oThis.colorScale);

            legend.append("text")
                .attr("x", oThis.width - righMargin)
                .attr("y", 3)
                .attr("dy", ".9em")
                .attr("text-anchor", "start")
                .style("font-size", ".7em")
                //.attr("fill", oThis.colorScale)
                .text(function(d) {
                    return d;
                });

            d3.select("#"+oThis.div)
                .on('contextmenu', function () {
                    d3.event.preventDefault();

                    oThis.tooltip.classed('hidden', false)
                        .attr('style', 'left:' + (d3.event.pageX) +
                            'px; top:' + (d3.event.pageY) + 'px')
                        .html(function () {
                            var res = "<h4>Filtrer les utilisateurs</h4>";
                            var checked;

                            for (let x of oThis.allUsers) {
                                checked = "";
                                if (oThis.displayedUser.has(x))
                                    checked = "checked"
                                res += "<label><input type='checkbox'  class='userFilter' id=" + x + " value=" + x + " " + checked + " >" + x + "</label><br>";
                            }

                            return res;
                        });

                    oThis.addCheckboxListener();
                })
                .on('click', function () {
                    oThis.tooltip.classed('hidden', true);
                });

        });

    };

    addCheckboxListener() {
        var oThis = this;
        var selectedUser = new Set(oThis.displayedUser);

        this.tooltip
            .selectAll('input')
            .on("change", function () {
                if (this.checked) {
                    selectedUser.add(this.value);
                    oThis.filterByUser(selectedUser);
                }
                else {
                    if (selectedUser.size > 1) {
                        selectedUser.delete(this.value);
                        oThis.filterByUser(selectedUser);
                    }
                    else
                        this.checked = true;
                }
            });
    }

    filterByUser(userList) {
        var oThis = this;

        // remove the non-selected user
        this.svg.selectAll('.proactiveFollowup')
            .filter(function (d) {
                return !userList.has(d[0].subject);
            })
            .remove().exit();

        this.svg.selectAll("circle")
            .filter(function (d) {
                return !userList.has(d.subject);
            })
            .remove().exit();

        // the old points
        var dataset = this.svg.selectAll("circle")
            .data().slice();

        // add the missing user
        for (let user of userList) {
            if (!this.displayedUser.has(user)) {
                var data;
                for (var u = 0; u < this.subjectData.length; u++) {
                    if (this.subjectData[u].key == user) {
                        data = this.subjectData[u].values;
                        break;
                    }
                }

                this.svg.append("path")
                    .data([data])
                    .attr("class", "proactiveFollowup")
                    .attr("d", this.line)
                    .style("fill", "none")
                    .style("stroke", function () {
                        return oThis.colorScale(user);
                    })
                    .style("stroke-width", "2px")
                    .style("opacity", 30);

                for (var j = 0; j < data.length; j++) {
                    dataset.push(data[j]);
                }

            }
        }

        this.svg.selectAll("circle")
            .data(dataset)
            .enter()
            .append("circle")
            .attr("class", "point")
            .attr("cx", function(d) { return oThis.xScale(oThis.getAbsoluteStepNb(+d['m:stepNumber'], +d['m:subStepNumber'])); })
            .attr("cy", function(d) { return oThis.yScale(+d['m:noise'] + oThis.noise.get(d['@id'])); })
            .attr("r", 4.5)
            .style("fill", function (d) {
                return oThis.colorScale(d.subject);
            })
            .style("opacity", 30)
            .on("mouseover", function (d) {
                oThis.tool_tip.show(d);

                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr("r", 7);

            })
            .on("mouseout", function (d) {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr("r", 4.5);

                oThis.tool_tip.hide(d);
            });


        this.displayedUser = new Set(userList);

        //TODO: update xScale
        //oThis.xScale.domain([0, totalNbStep]);

        oThis.yScale.domain([0, d3.max(this.subjectData, function (d) {
            if (userList.has(d.key)) {
                return d3.max(d.values, function (u) {
                   return u["m:noise"];
                })
            }
            return 0;
        })]);

        // set the number of ticks
        oThis.yAxis.ticks(oThis.yScale.domain()[1]);

        var body = oThis.svg.transition();

        body.select(".y.axis") // change the y axis
            .duration(750)
            .call(oThis.yAxis);

        this.svg.selectAll('.proactiveFollowup')
            .transition()
            .duration(750)
            .attr("d", oThis.line);

        this.svg.selectAll("circle")
            .transition()
            .duration(750)
            .attr("cx", function(d) { return oThis.xScale(oThis.getAbsoluteStepNb(+d['m:stepNumber'], +d['m:subStepNumber'])); })
            .attr("cy", function(d) { return oThis.yScale(+d['m:noise'] + oThis.noise.get(d['@id'])); });


    };

    update(URL) {

        var oThis = this;

        // get the data in JSON
        var request = d3.json(URL)
            .on("beforesend", function(request) { request.withCredentials = true; })
            .mimeType("application/json");

        request.get(function (error, data) {

            if (error) throw error;

            // define scale for data
            oThis.xScale.domain([d3.min(data.obsels, function (d) {
                    return +d.end;
                }), d3.max(data.obsels, function (d) {
                    return +d.end;
                })]).range([0, oThis.width]);

            oThis.yScale.domain([0, d3.max(data.obsels, function (d) {
                    return +d['m:noise'];
                })]);

            oThis.xAxis.tickValues(data.obsels.map(function(d) { return d.end; }));
            //oThis.yAxis.tickValues(data.obsels.map(function(d) { return d["m:noise"]; }));

            var body = oThis.svg.transition();

            // update the axis
            body.select(".x.axis") // change the x axis
                .duration(750)
                .call(oThis.xAxis)
                .selectAll("text")
                .style("text-anchor", "end")
                .attr("dx", "-.8em")
                .attr("dy", "-.55em")
                .attr("transform", "rotate(-90)" );

            body.select(".y.axis") // change the y axis
                .duration(750)
                .call(oThis.yAxis);

            // remove all the label values
            oThis.svg.selectAll(".point").remove().exit();

            // draw the point
            var selection = oThis.svg.selectAll("circle")
                .remove()
                .exit().data(data.obsels);

            selection.enter().append("circle")
                .attr("class", "point")
                .attr("cx", function(d) { return oThis.xScale(d.end); })
                .attr("cy", function(d) { return oThis.yScale(d['m:noise'] + oThis.noise.get(d['@id'])); })
                .attr("r", 2.5);


            // draw the line
            oThis.line.x(function (d) {
                return oThis.xScale(d.end);
            })
                .y(function (d) {
                    return oThis.yScale(d['m:noise'] + oThis.noise.get(d['@id']));
                });

            body.select(".timeLine")   // change the line
                .duration(750)
                .attr("d", oThis.line(data.obsels));

        });
    }

    /**
     * Filtre la vue selon la liste d'utilisateur passer en paramètre
     * @param param la liste d'utilisateur à filtrer
     *
     * Recreer la trace fusionnée comme source les utilisateurs choisis
     */
    filterByUserTrace(newSources, base_URL) {
        // 1 - PUT the fusion trace with restrain use
        var newSourcesURI = [];

        for (var i = 0; i < newSources.length; i++) {
            newSourcesURI.push("../" + RULES_AND_ACTIONS_TRIGGER_STATS + '_' + newSources[i] + '/');
        }

        var eTag;

        JSONrequest(base_URL + FUSION_RULES_AND_ACTIONS_TRIGGER_STATS_URI)
            .response(function(xhr) { eTag = xhr.getResponseHeader("Etag"); return JSON.parse(xhr.responseText); })
            .send("GET", function (error, data) {
                if (error) throw error;

                data.hasSource = newSourcesURI;

                JSONrequest(base_URL + FUSION_RULES_AND_ACTIONS_TRIGGER_STATS_URI)
                    .header("if-match", eTag)
                    .header("Content-Type", "application/json")
                    .send("PUT", JSON.stringify(data), function (error, data) {
                        if (error) throw error;

                        console.log(data);
                    });


            });


        // 2 - update the view
        this.update(base_URL + FUSION_RULES_AND_ACTIONS_TRIGGER_STATS_URI);

    };

    getAbsoluteStepNb(stepNb, subStepNb) {

        var global = 0;

        for (var entry of this.subSteps.entries()) {
            if (entry[0] >= stepNb) {
                return subStepNb + global;
            }
            global += entry[1];
        }
    };

    generateRandomNumber(min, max) {
        return Math.random() * (max - min) + min;
    };

    createAndFillActionIdList(ids) {
        var oThis = this;

        // get the drop down list for the user selection

        var div = document.querySelector("#"+this.div).querySelector("#filterContainer"),
            frag = document.createDocumentFragment(),
            select = document.createElement("select");
        select.setAttribute("id", "proactiveActionId_" + this.div);

        for (var i = 0; i < ids.length; i++) {
            select.options.add(new Option(ids[i]));
        }

        frag.appendChild(select);
        div.appendChild(frag);

        // TODO: code the update funtion
        select.addEventListener("change", function () {
            //oThis.filterProactiveAction(this.value);
        });
    }
}
