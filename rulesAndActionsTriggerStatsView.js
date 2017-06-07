/**
 * Created by raphael on 25/04/2017.
 */


class RuleAndActionStatsView {

    constructor(_div) {
        this.div = _div;
        // set up svg using margin conventions
        this.margin = {
            top: 40,
            right: 100,
            bottom: 40,
            left: 30
        };

        this.width = 600 - this.margin.left - this.margin.right;
        this.height = 300 - this.margin.top - this.margin.bottom;
        //this.width = document.getElementById(this.div).offsetWidth - this.margin.left - this.margin.right;
        //this.height = document.getElementById(this.div).offsetHeight - this.margin.top - this.margin.bottom;

        this.titleDiv = d3.select('#' + _div)
            .append('div')
            .attr('class', 'title');

        this.contentArea = d3.select("#" + this.div).append("svg")
            .attr("width", this.width + this.margin.left + this.margin.right)
            .attr("height", this.height + this.margin.top + this.margin.bottom);

        // set up svg
        this.svg = this.contentArea
            .append("g")
            .attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");

        // tooltip
        this.tooltip = d3.select('body')
            .append('div')
            .attr('class', 'hidden tooltip');

        this.tool_tip = d3.tip()
            .attr("class", "d3-tip")
            .offset([-8, 0]);

        // set the ranges
        this.x = d3.scaleBand()
            .rangeRound([0, this.width])
            .paddingInner(0.1)
            .paddingOuter(0.3);

        this.y = d3.scaleLinear().range([this.height, 0]);

        // define the axis
        this.xAxis = d3.axisBottom(this.x);

        this.yAxis = d3.axisLeft(this.y)
            .ticks(10);

        //action, consultation, rule
        this.colorScale = d3.scaleOrdinal()
            .range(['#FFCEAA','#FFFFAA','#BAEA86'])
            .domain(['A','C','R']);
    }


    draw(URL){

        this.titleDiv
            .style("text-align", "center")
            .append("h4")
            .text("Assistance : Déclenchement des éléments");

        // apply the tooltip
        this.tool_tip.html(function (d) {
            var time = d.values.reduce(function (res, val) {
                return res + val["m:avgTime"];
            }, 0);

            var displayTime;
            if (time == 0) {
                displayTime = "Inconnu";
            }
            else {
                displayTime = Math.round(time * 100) / 100 + " ms";
            }
            var message;
            if (d.key.startsWith('A')) {
                message = "Durée moy. de l'action d'assistance : ";
            }
            else if (d.key.startsWith('C')) {
                message = "Temps de réponse moy. des utilisateurs à la consultaion : ";
            }
            else if (d.key.startsWith('R')) {
                message = "Durée moy. de la règle d'assistance : ";
            }
            return "<span>" + message + displayTime + "</span>";
        });

        this.svg.call(this.tool_tip);


        var oThis = this;

        var request = d3.json(URL)
            .on("beforesend", function(request) { request.withCredentials = true; })
            .mimeType("application/json");

        request.get(function (error, data) {
            if (error) throw error;

            var dataset = d3.nest()
                .key(function(d) { return d["m:sourceId"]; })
                .entries(data.obsels);

            // scale the range of the data
            oThis.x.domain(data.obsels.map(function(d) { return d["m:sourceId"]; }).sort());

            oThis.y.domain([0, d3.max(dataset.map(function(d) {
                return d3.sum(d.values, function (t) {
                    return t["m:count"];
                });
            }))]);

            // add axis
            oThis.svg.append("g")
                .attr("class", "x_axis")
                .attr("transform", "translate(0," + oThis.height + ")")
                .call(oThis.xAxis)
                .append("text")
                .attr("class", "label")
                .attr("transform", "translate(" + oThis.width / 2 + ", 0)")
                .attr("y", 6)
                .attr("dy", "2.7em")
                .style("text-anchor", "middle")
                .style("fill", "black")
                .text("Éléments du système d'assistance");


            oThis.svg.append("g")
                .attr("class", "y_axis")
                .call(oThis.yAxis)
                .append("text")
                .attr("class", "label")
                .attr("transform", "rotate(-90)")
                .attr("y", 6)
                .attr("dy", ".71em")
                .style("text-anchor", "end")
                .style("fill", "black")
                .text("Nb de déclenchements");

            // Add bar chart
            oThis.svg.selectAll(".bar")
                .data(dataset)
                .enter().append("rect")
                .attr("class", "bar")
                .attr("x", function(d) { return oThis.x(d.key); })
                .attr("width", oThis.x.bandwidth())
                .attr("y", function(d) { return oThis.y(d3.sum(d.values, function (t) {
                    return t["m:count"];
                })); })
                .attr("height", function(d) { return oThis.height - oThis.y(d3.sum(d.values, function (t) {
                        return t["m:count"];
                    })); })
                .style("fill", function (d) {
                    return oThis.getColor(d);
                })
                .on("mouseover", function(d) {
                    //show tooltip
                    oThis.tool_tip.show(d);
                })
                .on("mouseout", function (d) {
                    //hide tooltip
                    oThis.tool_tip.hide(d);
                    //oThis.tooltip.classed('hidden', true);
                })
                .on("click", function(d){
                    // TODO for expe purpose only
                    var id = d.key;
                    // check if the selected bar correspond to a consultation
                    if (id.startsWith("C")) {
                        // get the combobox by id
                        // set the selected value to the id
                        var combo = document.getElementById("consultationId");
                        combo.value = id;
                        // fire the change event
                        var event = new Event('change');
                        var evt = document.createEvent("HTMLEvents");
                        evt.initEvent("change", false, true);
                        combo.dispatchEvent(evt);
                    }
                    if (id.startsWith("A")) {
                        // get the proactive view combobox
                        // check if the id is in the list
                        // update the view
                    }
                });

            // TODO: handle categories dynamically
            // categorie legend
            var legend = oThis.contentArea.selectAll(".legend")
                .data(["Action d'assistance", "Consultation de l'utilisateur", "Règle d'assistance"])
                .enter().append("g")
                .attr("class", "legend")
                .attr("transform", function(d, i) { return "translate(0," + (i*20) + ")"; });

            var righMargin = 19;
            legend.append("rect")
                .attr("x", oThis.width - righMargin - 14)
                .attr("width", 12)
                .attr("height", 12)
                .attr("fill", oThis.colorScale);

            legend.append("text")
                .attr("x", oThis.width - righMargin)
                .attr("y", 9)
                .attr("dy", ".12em")
                .attr("text-anchor", "start")
                .style("font-size", ".7em")
                .text(function(d) { return d; });
        });

    }

    update(URL){
        var oThis = this;

        var request = d3.json(URL)
            .on("beforesend", function(request) { request.withCredentials = true; })
            .mimeType("application/json");

        request.get(function (error, data) {
            if (error) throw error;


            // scale the range of the data
            oThis.x.domain(data.obsels.map(function(d) { return d["m:sourceId"]; }).sort());

            oThis.y.domain([0, d3.max(data.obsels.map(function(d) { return d["m:count"]; }))]);

            // Select the section we want to apply our changes to
            var body = oThis.svg.transition();

            // update the axis
            body.select(".x.axis") // change the x axis
                .duration(750)
                .call(oThis.xAxis);

            body.select(".y.axis") // change the y axis
                .duration(750)
                .call(oThis.yAxis);

            // remove all the bar from the graph
            var bars = oThis.svg.selectAll(".bar")
                .remove()
                .exit()
                .data(data.obsels, function(d) { return d.subject + d["m:sourceId"]; });


            // Add bar chart
            bars.enter().append("rect")
                .attr("class", "bar")
                .style("fill", "steelblue")
                .transition()
                .attr("x", function(d) { return oThis.x(d["m:sourceId"]); })
                .attr("width", oThis.x.bandwidth())
                .attr("y", function(d) { return oThis.y(d["m:count"]); })
                .attr("height", function(d) { return oThis.height - oThis.y(d["m:count"]); })
                .duration(750);

            oThis.svg.selectAll(".bar")
                .on("mouseover", function(d) {
                    //show tooltip
                    oThis.tool_tip.show(d);
                    oThis.tooltip.classed('hidden', false)
                        .style("left", d3.event.pageX - 50 + "px")
                        .style("top", d3.event.pageY - 70 + "px")
                        .html(function () {
                            var time = +d["m:avgTime"];
                            var displayTime;
                            if (time == 0) {
                                displayTime = "NA";
                            }
                            else {
                                displayTime = Math.round(+d["m:avgTime"] * 100) / 100 + "ms";
                            }
                            return "Temps moy : " + displayTime;
                        });
                })
                .on("mouseout", function (d) {
                    //hide tooltip
                    oThis.tool_tip.hide(d);
                    oThis.tooltip.classed('hidden', true);
                });
        });
    }

    /**
     * Filtre la vue selon la liste d'utilisateur passer en paramètre
     * @param param la liste d'utilisateur à filtrer
     *
     * Recreer la trace fusionnée comme source les utilisateurs choisis
     */
    filterByUser(newSources, base_URL) {
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

    getColor(d) {

        var id = d.key;

        return this.colorScale(id.charAt(0));

    };

    // TODO: implement this function
    filterByTime(param){};
}