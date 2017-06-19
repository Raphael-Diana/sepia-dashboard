class menuSearchView {
    constructor(_div) {
        this.div = _div;

        this.margin = {
            top: 15,
            right: 25,
            bottom: 60,
            left: 50
        };

        this.width = 600 - this.margin.left - this.margin.right;
        this.height = 300 - this.margin.top - this.margin.bottom;

        //this.width = document.getElementById(this.div).offsetWidth - this.margin.left - this.margin.right;
        //this.height = document.getElementById(this.div).offsetHeight - this.margin.top - this.margin.bottom;

       this.titleDiv = d3.select('#' + _div)
            .append('div')
            .attr('class', 'title');

        this.graphicArea = d3.select('#' + _div)
            .append("svg")
            .attr("id", "menuSearchContent")
            .attr("width", this.width + this.margin.left + this.margin.right)
            .attr("height", this.height + this.margin.top + this.margin.bottom);

        // set up principal svg element
        this.svg = this.graphicArea
            .append("g")
            .attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");

        this.tool_tip = d3.tip()
            .attr("class", "d3-tip")
            .offset([-8, 0]);

        // define the scale
        this.xScale = d3.scaleBand()
            .rangeRound([0, this.width])
            .paddingInner(0.1)
            .paddingOuter(0.5);

        this.yScale = d3.scaleLinear()
            .rangeRound([this.height, 0]);

        // define the axis
        this.xAxis = d3.axisBottom(this.xScale);
        this.yAxis = d3.axisLeft(this.yScale);

        this.itemMenu = new Map();


    }

    draw(URL) {
        var oThis = this;

        this.titleDiv
            .style("text-align", "center")
            .append("h4")
            .text(targetAppName + " : Temps passé à rechercher dans les menus");

        //TODO: set the tooltip


        // map the item menu to the menu
        d3.xml(interfaceDescription, function (error, xml) {
            if (error) throw error;

            var composants = d3.select(xml).selectAll("composant")
                .filter(function () {
                    return (this.attributes.id.nodeValue.startsWith("fo_ApplicationWindow_") && this.attributes.type.nodeValue == "mt_POPUP");//&& this.parentNode.nodeName != "composant");
                })
                .each(function () {
                    //map each component to its parent
                    var menuDescr = this.attributes.descriptionAjoutee.nodeValue;
                    d3.select(this).selectAll("composant").each(function () {
                        /*if (oThis.itemMenu.has(this.id)) {
                            if (oThis.itemMenu.get(this.id))
                                this.previousSibling;
                        }*/
                        oThis.itemMenu.set(this.id, menuDescr);
                    });
            });


            var request = d3.json(URL)
                .on("beforesend", function(request) { request.withCredentials = true; })
                .mimeType("application/json");

            request.get(function (error, data) {
                if (error) console.error(error);


                //render the data
                var subMenus = [];

                var menus = data.obsels.reduce(function (res, val) {
                    if(!subMenus.includes(val['m:sourceId']))
                        subMenus.push(val['m:sourceId']);
                    var menu = oThis.itemMenu.get(val['m:sourceId']);
                    if (!res.includes(menu))
                    res.push(menu);
                    return res;
                }, []);
                //set x axis domain
                oThis.xScale.domain(menus);

                //set y axis domain
                oThis.yScale.domain([0, d3.max(data.obsels, function (d) {
                    return d.end - d.begin;
                })]);

                //oThis.yAxis.tickFormat(d3.format(",.0f"));

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
                    .text("Temps passé dans le menu en ms");

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
                    .text("Menu de " + targetAppName);

                var x1 = d3.scaleBand()
                    .padding(0.1);
                x1.domain(subMenus).rangeRound([0, oThis.xScale.bandwidth()]);

                oThis.svg.selectAll(".bar")
                    .data(data.obsels)
                    .enter().append("rect")
                    .attr("class", "bar")
                    .attr("transform", function(d) { return "translate(" + x1(d['m:sourceId']) + ",0)"; })
                    .attr("x", function(d) { return oThis.xScale(oThis.itemMenu.get(d['m:sourceId'])); })
                    .attr("y", function(d) { return oThis.yScale(d.end - d.begin); })
                    .attr("width", x1.bandwidth())
                    .attr("height", function(d) { return oThis.height - oThis.yScale(d.end - d.begin); })
                    .attr("fill", function(d) { return "#91bfdb"; });

            });

        });
    }
}