/**
 * Created by raphael on 27/04/2017.
 */
var RULES_AND_ACTIONS_TRIGGER_STATS = "rulesAndActionsTriggerStats"
var FUSION_RULES_AND_ACTIONS_TRIGGER_STATS_URI = "fusion_rulesAndActionsTriggerStats_all/";


class ConsultationAnswerStatsView {

    constructor(_div) {
        this.div = _div;

        this.margin = {
            top: 15,
            right: 25,
            bottom: 60,
            left: 300
        };

        this.width = 600 - this.margin.left - this.margin.right;
        this.height = 300 - this.margin.top - this.margin.bottom;
        //this.width = document.getElementById(this.div).offsetWidth - this.margin.left - this.margin.right;
        //this.height = document.getElementById(this.div).offsetHeight - this.margin.top - this.margin.bottom;

        this.titleDiv = d3.select('#' + _div)
            .append('div')
            .attr('class', 'title');

        // add a div for the filter component
        this.filterDiv = d3.select('#' + _div)
            .append('div')
            .attr('id', 'filterContainer')
            .style("padding-left", "0.7em");

        this.contentArea = d3.select("#" + _div)
            .append("svg")
            .attr("id", "consultationAnswerContent")
            .attr("class", "viewContainer")
            .attr("width", this.width + this.margin.left + this.margin.right)
            .attr("height", this.height + this.margin.top + this.margin.bottom);


        // set up principal svg element
        this.svg = this.contentArea
            .append("g")
            .attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");

        this.tool_tip = d3.tip()
            .attr("class", "d3-tip")
            .offset([-8, 0]);


        // define scale for data
        this.xScale = d3.scaleLinear().range([0, this.width]);
        this.yScale = d3.scaleBand().rangeRound([0, this.height], .1);

        // define the axis
        this.yAxis = d3.axisLeft(this.yScale);

        // tooltip
        this.tooltip = d3.select('body')
            .append('div')
            .attr('id', 'context_menu_consultation')
            .attr('class', 'hidden context_menu tooltip');

        this.yAxisG = this.svg.append("g")
            .attr("class", "y axis");

        this.consultations = [];
        this.index;
        this.myMap = new Map();
        this.allUsers = new Set();
        this._selectedUsers = new Set();
        this.contextMenuShowing = false;

    };


    addOptions(selectbox) {
        for (var i = 0; i < this.consultations.length; i++) {
            selectbox.options.add(new Option(this.consultations[i].id));
        }
    }

    removeOptions(selectbox) {
        var i;
        for (i = selectbox.options.length - 1; i >= 0; i--) {
            selectbox.remove(i);
        }
    }

    createAndFillConsultationIdList(ids) {
        var oThis = this;

        // get the drop down list for the user selection
        var div = document.querySelector("#"+this.div).querySelector("#filterContainer"),
            frag = document.createDocumentFragment(),
            select = document.createElement("select");
            select.setAttribute("id", "consultationId");

        for (var i = 0; i < ids.length; i++) {
            select.options.add(new Option(ids[i]));
        }

        frag.appendChild(select);
        div.appendChild(frag);

        select.addEventListener("change", function () {
            oThis.filterConsultAnswer(this.value);
        });
    }

    /**
     * Draw the view from the URL passed in parameter
     * @param URL
     */
    draw(URL) {
        this.titleDiv
            //.style("display", "inline-block")
            //.style("vertical-align", "middle")
            .style("text-align", "center")
            //.append("img")
            //.attr("src", "Ressources/buoy.png")
            //.style("width", "1em");

        this.titleDiv
            .append("h4")
            .text("Assistance : Réponses aux consultations");


        // the tooltip content
        this.tool_tip.html(function(d) { return "Temps moy : " + d.toFixed(0) + " ms"; });
        this.svg.call(this.tool_tip);

        var oThis = this;

        var request = d3.json(URL)
            .on("beforesend", function(request) { request.withCredentials = true; })
            .mimeType("application/json");

        request.get(function (error, data) {

            if (error) throw error;

            var ids = [];
            // for each obsel in the trace
            data.obsels.forEach(function (d) {

                var id = d["m:sourceId"];
                var value = d["m:value"];
                var answer = {};
                answer.occurence = +d["m:occurence"];
                answer.avgTime = +d["m:avgTime"];
                answer.subject = d.subject;

                oThis.allUsers.add(d.subject);

                // aggregate data by consultation id and answer value

                if (!oThis.myMap.has(id)) {
                    ids.push(id);
                    var option = {};
                    option.value = value;
                    option.answers = [answer];

                    oThis.myMap.set(id, [option]);
                }
                else {
                    for (var i = 0; i < oThis.myMap.get(id).length; i++) {
                        if (oThis.myMap.get(id)[i].value == value) {
                            oThis.myMap.get(id)[i].answers.push(answer);
                            break;
                        }
                    }
                    if (i >= oThis.myMap.get(id).length) {
                        var option = {};
                        option.value = value;
                        option.answers = [answer];
                        oThis.myMap.get(id).push(option);
                    }
                }

            });


            oThis.index = ids.sort()[0];
            var displayedConsultation = oThis.myMap.get(oThis.index);

            // copy the user set
            oThis._selectedUsers = new Set(oThis.allUsers);

            oThis.filterDiv
                .append("text")
                .text("Consultation ")
            oThis.createAndFillConsultationIdList(ids);
            oThis.filterDiv
                .append("br");
            oThis.filterDiv
                .append("text")
                .text("Intitulé : ")
                .append("i")
                .attr("class", "consultEntitled")
                .text(oThis.getConsultationEntitled(oThis.index));

            // compute the max occurence
            var maxOcc = displayedConsultation.reduce(function (res, val) {
                var max = val.answers.reduce(function (res, val) {
                    return res + val.occurence;
                }, 0);

                if (max > res)
                    return max;
                return res;
            }, 0);


            // get the option labels
            var optionLabels = [];
            for (var i = 0; i < displayedConsultation.length; i++) {
                optionLabels.push(displayedConsultation[i].value);
            }

            // set the scales
            oThis.xScale.domain([0, maxOcc]);
            oThis.yScale.domain(optionLabels)
                .paddingInner(.1);

            oThis.yAxis.tickSize(0);

            oThis.yAxisG.call(oThis.yAxis);

            var bars = oThis.svg.selectAll(".bar")
                .data(displayedConsultation)
                .enter();

            //append rectangles
            bars.append("rect")
                .attr("class", "bar")
                .attr("y", function (d) {
                    return oThis.yScale(d.value);
                })
                .attr("height", oThis.yScale.bandwidth())
                .attr("x", 0)
                .attr("width", function (d) {
                    var totalOcc = d.answers.reduce(function (res, val) {
                        return res + val.occurence;
                    }, 0);
                    return oThis.xScale(totalOcc);
                })
                .style("fill", "#80B1D3")
                .on("mouseover", function (d) {
                    var y = this.getAttribute("y");

                    var totalOcc = d.answers.reduce(function (res, val) {
                        return res + val.occurence;
                    }, 0);
                    var avgTime = d.answers.reduce(function (res, val) {
                        return res + val.occurence * val.avgTime;
                    }, 0);

                    avgTime /= totalOcc;

                    //show tooltip
                    oThis.tool_tip.show(avgTime);

                    //highlight legend
                    var eachBand = oThis.yScale.step();
                    var index = Math.round((y / eachBand));

                    /*oThis.yAxisG.selectAll('.tick')
                        .filter(function (d, i) {
                            return i === index;
                        })
                        .select("text")
                        .style("font-size", "18px");*/

                })
                .on("mouseout", function (d) {
                    //hide tooltip
                    oThis.tool_tip.hide(d);

                    //reset legend style
                    var y = this.getAttribute("y");
                    var eachBand = oThis.yScale.step();
                    var index = Math.round((y / eachBand));

                    oThis.yAxisG.selectAll('.tick')
                        .filter(function (d, i) {
                            return i === index;
                        })
                        .select("text")
                        .style("font-size", "15px");
                });


            oThis.yAxisG.selectAll('.tick')
                .select("text")
                .style("font-size", "15px");

            //add a value label to the right of each bar
            bars.append("text")
                .attr("class", "label")
                //y position of the label is halfway down the bar
                .attr("y", function (d) {
                    return oThis.yScale(d.value) + oThis.yScale.bandwidth() / 2 + 4;
                })
                //x position is 3 pixels to the right of the bar
                .attr("x", function (d) {
                    var totalOcc = d.answers.reduce(function (res, val) {
                        return res + val.occurence;
                    }, 0);
                    return oThis.xScale(totalOcc) + 2;
                })
                .text(function (d) {
                    var totalOcc = d.answers.reduce(function (res, val) {
                        return res + val.occurence;
                    }, 0);
                    return totalOcc;
                })
                .style("font-size", "15px");

        });

        d3.select("#"+oThis.div)
            .on('contextmenu', function (d, i) {
                d3.event.preventDefault();

                var mouse = d3.mouse(oThis.svg.node()).map(function(d) {
                    return parseInt(d);
                });


                oThis.tooltip.classed('hidden', false)
                    .attr('style', 'left:' + (d3.event.pageX) +
                        'px; top:' + (d3.event.pageY) + 'px')
                    .html(function () {
                        var res = "<h4>Filtrer les utilisateurs</h4>";
                        var checked;

                        for (let x of oThis.allUsers) {
                            checked = "";
                            if (oThis._selectedUsers.has(x))
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

    };

    /**
     * Update the view from another URL
     * @param URL
     */
    // TODO: refactor to work with the new data structure
    update(URL) {

        this.consultations = [];

        var oThis = this;

        var request = d3.json(URL)
            .on("beforesend", function(request) { request.withCredentials = true; })
            .mimeType("application/json");

        request.get(function (error, data) {

            if (error) throw error;

            // for each obsel in the trace
            data.obsels.forEach(function (d) {

                var id = d["m:sourceId"];
                var option = {};
                option.value = d["m:value"];
                option.occurence = +d["m:occurence"];
                option.avgTime = +d["m:avgTime"];
                // aggregate data by consultation id
                for (var i = 0; i < oThis.consultations.length; i++) {
                    if (oThis.consultations[i].id == id) {
                        oThis.consultations[i].options.push(option)
                        break;
                    }
                }
                // if the consultation id is not already in the array
                if (i >= oThis.consultations.length) {
                    oThis.consultations.push({"id": id, "options": [option]});
                }
            });

            var selectBox = document.getElementById("consultationId");
            oThis.removeOptions(selectBox);
            oThis.addOptions(selectBox);

            oThis.xScale.domain([0, d3.max(oThis.consultations[oThis.index].options, function (d) {
                return d.occurence;
            })]);

            oThis.yScale.domain(oThis.consultations[oThis.index].options.map(function (d) {
                return d.value;
            }).sort());

            // Select the section we want to apply our changes to
            var body = oThis.svg.transition();

            // update the axis
            body.select(".y.axis") // change the y axis
                .duration(750)
                .call(oThis.yAxis);

            oThis.yAxisG.selectAll(".tick")
                .select("text")
                .style("font-size", "15px");


            // remove all the bar from the graph
            var bars = oThis.svg.selectAll(".bar")
                .remove()
                .exit()
                .data(oThis.consultations[oThis.index].options)
                .enter();

            //append rectangles
            bars.append("rect")
                .attr("class", "bar")
                .style("fill", "#80B1D3")
                .transition()
                .attr("y", function (d) {
                    return oThis.yScale(d.value);
                })
                .attr("height", oThis.yScale.bandwidth())
                .attr("x", 0)
                .attr("width", function (d) {
                    return oThis.xScale(d.occurence);
                })
                .duration(750);

            oThis.svg.selectAll(".bar")
                .on("mouseover", function (d) {
                    var y = this.getAttribute("y");

                    //show tooltip
                    oThis.tool_tip.show(d);
                    oThis.tooltip.classed('hidden', false)
                        .style("left", d3.event.pageX - 50 + "px")
                        .style("top", d3.event.pageY - 70 + "px")
                        .html("Temps moy : " + (d.avgTime) + " ms");

                    //highlight legend
                    var eachBand = oThis.yScale.step();
                    var index = Math.round((y / eachBand));

                    oThis.yAxisG.selectAll('.tick')
                        .filter(function (d, i) {
                            return i === index;
                        })
                        .select("text")
                        .style("font-size", "18px");

                })
                .on("mouseout", function (d) {
                    //hide tooltip
                    oThis.tool_tip.hide(d);
                    oThis.tooltip.classed('hidden', true);

                    //reset legend style
                    var y = this.getAttribute("y");
                    var eachBand = oThis.yScale.step();
                    var index = Math.round((y / eachBand));

                    oThis.yAxisG.selectAll('.tick')
                        .filter(function (d, i) {
                            return i === index;
                        })
                        .select("text")
                        .style("font-size", "15px");
                });

            // remove all the label values
            oThis.svg.selectAll(".label").remove().exit();

            //add a value label to the right of each bar
            bars.append("text")
                .attr("class", "label")
                //y position of the label is halfway down the bar
                .attr("y", function (d) {
                    return oThis.yScale(d.value) + oThis.yScale.bandwidth() / 2 + 4;
                })
                //x position is 3 pixels to the right of the bar
                .attr("x", function (d) {
                    return oThis.xScale(d.occurence) + 3;
                })
                .text(function (d) {
                    return d.occurence;
                })
                .style("font-size", "15px");

        });
    };


    filterConsultAnswer(consultationId) {
        // TODO : check yScale

        this.filterDiv.select(".consultEntitled")
            .text(this.getConsultationEntitled(consultationId));
        
        var oThis = this;
        this.index = consultationId;

        // search the answers for the consultation
        var displayedConsultation = oThis.myMap.get(consultationId);
        var oldConsultation = Array.from(displayedConsultation);
        var optionToRemove = [];
        if (displayedConsultation != 'undefined') {

            // compute the max occurence
            var maxOcc = displayedConsultation.reduce(function (res, val) {
                var max = oThis.getTotalOccurence(val);

                if (max > res)
                    return max;
                return res;
            }, 0);

            // get the option labels
            var optionLabels = [];
            for (var i = 0; i < oldConsultation.length; i++) {
                for (var j = 0; j < oldConsultation[i].answers.length; j++) {
                    /*if (oThis._selectedUsers.has(oldConsultation[i].answers[j].subject)) {
                        optionLabels.push(oldConsultation[i].value);
                        break;
                    }*/
                    optionLabels.push(oldConsultation[i].value);
                }
                if (j >= oldConsultation[i].answers.length) {
                    optionToRemove.push(i);
                }
            }

            /*for (var i = optionToRemove.length - 1; i >= 0; i--) {
                displayedConsultation.splice(optionToRemove[i], 1);
            }*/

            // TODO: remove for expe purpose only
            if (consultationId == "C1")
                optionLabels.push("Ok");

            // scale the range of the data
            oThis.xScale
                .domain([0, maxOcc]);

            oThis.yScale.domain(optionLabels);

            // Select the section we want to apply our changes to
            var body = oThis.svg.transition();

            // update the axis
            body.select(".y.axis") // change the y axis
                .duration(750)
                .call(oThis.yAxis);

            // remove all the bar from the graph
            var bars = oThis.svg.selectAll(".bar")
                .remove()
                .exit().data(displayedConsultation);

            bars.enter()
                .append("rect")
                .attr("class", "bar")
                .transition()
                .attr("y", function (d) {
                    return oThis.yScale(d.value);
                })
                .attr("height", oThis.yScale.bandwidth())
                .attr("x", 0)
                .attr("width", function (d) {
                    return oThis.xScale(oThis.getTotalOccurence(d));
                })
                .duration(750);

            oThis.svg.selectAll(".bar")
                .style("fill", "#80B1D3")
                .on("mouseover", function (d) {
                    var y = this.getAttribute("y");

                    var totalOcc = oThis.getTotalOccurence(d);
                    var avgTime = oThis.getAvgTime(d);

                    avgTime /= totalOcc;

                    //show tooltip
                    oThis.tool_tip.show(avgTime);

                    //highlight legend
                    var eachBand = oThis.yScale.step();
                    var index = Math.round((y / eachBand));

                    /*oThis.yAxisG.selectAll('.tick')
                        .filter(function (d, i) {
                            return i === index;
                        })
                        .select("text")
                        .style("font-size", "18px");*/

                })
                .on("mouseout", function (d) {
                    //hide tooltip
                    oThis.tool_tip.hide(d);
                    //oThis.tooltip.classed('hidden', true);

                    //reset legend style
                    var y = this.getAttribute("y");
                    var eachBand = oThis.yScale.step();
                    var index = Math.round((y / eachBand));

                    oThis.yAxisG.selectAll('.tick')
                        .filter(function (d, i) {
                            return i === index;
                        })
                        .select("text")
                        .style("font-size", "15px");

                });

            oThis.yAxisG.selectAll('.tick')
                .select("text")
                .style("font-size", "15px");

            // remove all the label values
            oThis.svg.selectAll(".label").remove().exit();

            bars.enter().append("text")
                .attr("class", "label")
                //y position of the label is halfway down the bar
                .attr("y", function (d) {
                    return oThis.yScale(d.value) + oThis.yScale.bandwidth() / 2 + 4;
                })
                //x position is 3 pixels to the right of the bar
                .attr("x", function (d) {
                    var totalOcc = oThis.getTotalOccurence(d);
                    return oThis.xScale(totalOcc) + 2;
                })
                .text(function (d) {
                    return oThis.getTotalOccurence(d);
                })
                .style("font-size", "15px");
        }
    };

    set selectedUsers(value) {
        this._selectedUsers = value;
    }

    filterByUser(userList) {
        var oThis = this;
        // TODO: change with interaction
        this._selectedUsers = userList;

        // search the answers for the consultation
        var oldConsultation = this.myMap.get(this.index);
        var displayedConsultation = Array.from(oldConsultation);
        var optionToRemove = [];

            if (oldConsultation != 'undefined') {

                // compute the max occurence
                var maxOcc = oldConsultation.reduce(function (res, val) {
                    var max = oThis.getTotalOccurence(val);

                    if (max > res)
                        return max;
                    return res;
                }, 0);

                // get the option labels
                var optionLabels = [];
                for (var i = 0; i < oldConsultation.length; i++) {
                    for (var j = 0; j < oldConsultation[i].answers.length; j++) {
                        if (oThis._selectedUsers.has(oldConsultation[i].answers[j].subject)) {
                            optionLabels.push(oldConsultation[i].value);
                            break;
                        }
                    }
                    if (j >= oldConsultation[i].answers.length) {
                        optionToRemove.push(i);
                    }
                }

                /*for (var i = optionToRemove.length - 1; i >= 0; i--) {
                    displayedConsultation.splice(optionToRemove[i], 1);
                }*/


            // scale the range of the data
            oThis.xScale
                .domain([0, maxOcc]);

            //oThis.yScale.domain(optionLabels);

            // Select the section we want to apply our changes to
            var body = oThis.svg.transition();

            // update the axis
            body.select(".y.axis") // change the y axis
                .duration(750)
                .call(oThis.yAxis);

            // remove all the bar from the graph
            var bars = oThis.svg.selectAll(".bar")
                .remove()
                .exit().data(displayedConsultation);

            bars.enter()
                .append("rect")
                .attr("class", "bar")
                .transition()
                .attr("y", function (d) {
                    return oThis.yScale(d.value);
                })
                .attr("height", oThis.yScale.bandwidth())
                .attr("x", 0)
                .attr("width", function (d) {
                    return oThis.xScale(oThis.getTotalOccurence(d));
                })
                .duration(750);

            oThis.svg.selectAll(".bar")
                .style("fill", "#80B1D3")
                .on("mouseover", function (d) {
                    var y = this.getAttribute("y");

                    var totalOcc = oThis.getTotalOccurence(d);
                    var avgTime = oThis.getAvgTime(d);

                    avgTime /= totalOcc;

                    //show tooltip
                    oThis.tool_tip.show(avgTime);
                    /*oThis.tooltip.classed('hidden', false)
                     .style("left", d3.event.pageX - 50 + "px")
                     .style("top", d3.event.pageY - 70 + "px")
                     .html("Temps moy : " + (d.avgTime) + " ms");*/

                    //highlight legend
                    var eachBand = oThis.yScale.step();
                    var index = Math.round((y / eachBand));

                    /*oThis.yAxisG.selectAll('.tick')
                        .filter(function (d, i) {
                            return i === index;
                        })
                        .select("text")
                        .style("font-size", "18px");*/

                })
                .on("mouseout", function (d) {
                    //hide tooltip
                    oThis.tool_tip.hide(d);
                    //oThis.tooltip.classed('hidden', true);

                    //reset legend style
                    var y = this.getAttribute("y");
                    var eachBand = oThis.yScale.step();
                    var index = Math.round((y / eachBand));

                    oThis.yAxisG.selectAll('.tick')
                        .filter(function (d, i) {
                            return i === index;
                        })
                        .select("text")
                        .style("font-size", "15px");

                });

            // remove all the label values
            oThis.svg.selectAll(".label").remove().exit();

            bars.enter().append("text")
                .attr("class", "label")
                //y position of the label is halfway down the bar
                .attr("y", function (d) {
                    return oThis.yScale(d.value) + oThis.yScale.bandwidth() / 2 + 4;
                })
                //x position is 3 pixels to the right of the bar
                .attr("x", function (d) {
                    var totalOcc = oThis.getTotalOccurence(d);
                    return oThis.xScale(totalOcc) + 2;
                })
                .text(function (d) {
                   return oThis.getTotalOccurence(d);
                })
                .style("font-size", "15px");
        }
    };

    /**
     * Filter the view according to the user list
     * @param param the user list to display
     *
     */
    filterByUserFusion(newSources, base_URL) {
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

    filterSelection(event) {
      console.log("filter");
    }

    // TODO: implement this filter
    filterByTime(param) {
        // 1 - Add the parameter in the query

        // 2 - update the view

    };

    getTotalOccurence(data) {
        var oThis = this;

        return data.answers.reduce(function (res, val) {
            // verify if the user is selected
            if (oThis._selectedUsers.has(val.subject))
                return res + val.occurence;
            else
                return res;

        }, 0);
    }

    getAvgTime(data) {
        var oThis = this;
        return data.answers.reduce(function (res, val) {
            if (oThis._selectedUsers.has(val.subject))
                return res + val.occurence * val.avgTime;
            else
                return res;
        }, 0);
    }

    addCheckboxListener() {
        var oThis = this;

        this.tooltip
            .selectAll('input')
            .on("change", function () {
                if (this.checked) {
                    oThis._selectedUsers.add(this.value);
                    oThis.filterByUser(oThis._selectedUsers);
                }
                else {
                    if (oThis._selectedUsers.size > 1) {
                        oThis._selectedUsers.delete(this.value);
                        oThis.filterByUser(oThis._selectedUsers);
                    }
                    else
                        this.checked = true;
                }
            });
    }

    // TODO: get this information from the trace
    getConsultationEntitled(id) {
        if (id == "C0") {
            return "\"Vous venez de créer une offre client. \nSouhaitez-vous de l'aide pour générer le bon de commande, le bon de livraison et la facture associés?\"";
        }
        if (id == "C1") {
            return "\"La date que vous avez choisie est en dehors de la période comptable. \nCréez une nouvelle période comptable avant de valider cette commande client.\"";
        }
        return "\"Intitulé de la consultation\"";
    }

}
