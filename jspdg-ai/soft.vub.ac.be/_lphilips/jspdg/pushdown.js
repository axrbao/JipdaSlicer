function HaltKont(rootSet)
{
  this.rootSet = rootSet;
}
HaltKont.prototype.toString =
  function ()
  {
    return "halt";
  }
HaltKont.prototype.apply =
  function (value, store, kont)
  {
    return [];
  }
HaltKont.prototype.hashCode =
  function ()
  {
    return 0;
  }
HaltKont.prototype.equals =
  function (x)
  {
    return this === x;
  }
HaltKont.prototype.addresses =
  function ()
  {
    return this.rootSet;
  }

function Push(frame)
{
  this.frame = frame;
}
Push.prototype.isPush = true;
Push.prototype.equals =
  function (x)
  {
    return x.isPush && Eq.equals(this.frame, x.frame);
  }
Push.prototype.hashCode =
  function ()
  {
    var prime = 11;
    var result = 1;
    result = prime * result + this.frame.hashCode();
    return result;    
  }
Push.prototype.toString =
  function ()
  {
    return "+" + this.frame;
  }
function Pop(frame)
{
  this.frame = frame;
}
Pop.prototype.isPop = true;
Pop.prototype.equals =
  function (x)
  {
    return x.isPop && Eq.equals(this.frame, x.frame);
  }
Pop.prototype.hashCode =
  function ()
  {
    var prime = 13;
    var result = 1;
    result = prime * result + this.frame.hashCode();
    return result;    
  }
Pop.prototype.toString =
  function ()
  {
    return "-" + this.frame;
  }
function Unch(frame)
{
  this.frame = frame;
}
Unch.prototype.isUnch = true;
Unch.prototype.equals =
  function (x)
  {
    return x.isUnch && Eq.equals(this.frame, x.frame);
  }
Unch.prototype.hashCode =
  function ()
  {
    var prime = 17;
    var result = 1;
    result = prime * result + HashCode.hashCode(this.frame);
    return result;    
  }
Unch.prototype.toString =
  function ()
  {
    return "e";//"\u03B5";
  }

function PushUnchKont(source, stack, etg, ecg)
{
  this.source = source;
  this.stack = stack;
  this.etg = etg;
  this.ecg = ecg;
}

PushUnchKont.prototype.push =
  function (frame, target, marks)
  {
    return [new Edge(this.source, new Push(frame), target, marks)];
  }

PushUnchKont.prototype.pop =
  function (frameCont, marks)
  {
    return [];
  }

PushUnchKont.prototype.unch =
  function (target, marks)
  {
    return [new Edge(this.source, new Unch(null), target, marks)];
  }

function PopKont(source, frame, stack, etg, ecg)
{
  this.source = source;
  this.frame = frame;
  this.stack = stack;
  this.etg = etg;
  this.ecg = ecg;
}

PopKont.prototype.push =
  function (frame, target, marks)
  {
    return [];
  }

PopKont.prototype.pop =
  function (frameCont, marks)
  {
    var frame = this.frame;
    var target = frameCont(frame);
    return [new Edge(this.source, new Pop(frame), target, marks)];
  }

PopKont.prototype.unch =
  function (target, marks)
  {
    return [];
  }

var ceskDriver = {};

ceskDriver.pushUnch =
  function (q, stack, etg, ecg)
  {
    var kont = new PushUnchKont(q, stack, etg, ecg);
    return q.next(kont);
  }

ceskDriver.pop =
  function (q, frame, stack, etg, ecg)
  {
    var kont = new PopKont(q, frame, stack, etg, ecg);
    return q.next(kont);
  }

function Pushdown()
{
}

Pushdown.run =
  function(q)
  {
    var k = ceskDriver;

    var etg = Graph.empty();
    var ecg = Graph.empty();
    var emptySet = ArraySet.empty();
    var ss = HashMap.empty().put(q, emptySet);
    var dE = [];
    var dH = [];
    var dS = [q];
    
    function propagateStack(s1, s2)
    {
      var currentSource = ss.get(s1, emptySet);
      var currentTarget = ss.get(s2, emptySet);
      var target = currentSource.join(currentTarget);
      ss = ss.put(s2, target);
    }
    
    function sprout(q)
    {
      var frames = ss.get(q, emptySet).values();
      var pushUnchEdges = k.pushUnch(q, frames, etg, ecg); 
      dE = dE.concat(pushUnchEdges);
//      dH = dH.concat(pushUnchEdges
//                .filter(function (pushUnchEdge) {return pushUnchEdge.g.isUnch})
//                .map(function (unchEdge) {return new EpsEdge(unchEdge.source, unchEdge.target)}));
    }

    function addPush(s, frame, q)
    { 
      propagateStack(s, q);
      ss = ss.put(q, ss.get(q).add(frame));
      var qset1 = ecg.successors(q);
      dE = dE.concat(qset1.flatMap(
        function (q1)
        {
          propagateStack(q, q1);
          var frames = ss.get(q1).values();
          var popEdges = k.pop(q1, frame, frames, etg, ecg);
          return popEdges;
        }));
      dH = dH.concat(dE.map(function (popEdge) {return new Edge(s, new Unch(frame), popEdge.target)}));
    }

    function addPop(s2, frame, q)
    {
      var sset1 = ecg.predecessors(s2);
      var push = new Push(frame);
      dH = dH.concat(sset1.flatMap(
        function (s1)
        {
          var sset = etg.incoming(s1)
                        .filter(function (edge) {return edge.g.equals(push)})
                        .map(function (pushEdge) {return pushEdge.source});
          return sset.map(
            function (s)
            {
              return new Edge(s, new Unch(frame), q);
            });
        }));
    }

    function addEmpty(s2, s3)
    {
      propagateStack(s2, s3);
      var sset1 = ecg.predecessors(s2);
      var sset4 = ecg.successors(s3);
      dH = dH.concat(sset1.flatMap(function (s1) {return sset4.map(function (s4) {return new Edge(s1, null, s4)})}));
      dH = dH.concat(sset1.map(
        function (s1) 
        {
          return new Edge(s1, null, s3)
        }));
      dH = dH.concat(sset4.map(
        function (s4)
        {
          return new Edge(s2, null, s4)
        }));
      var pushEdges = sset1.flatMap(
        function (s1)
        {
          return etg.incoming(s1).filter(function (edge) {return edge.g.isPush});
        });
      var popEdges = sset4.flatMap(
        function (s4)
        {
          propagateStack(s3, s4);
          return pushEdges.flatMap(
            function (pushEdge)
            {
              var frame = pushEdge.g.frame;
              var frames = ss.get(s4).values();
              var popEdges = k.pop(s4, frame, frames, etg, ecg);
              return popEdges;
            })
        });
      dE = dE.concat(popEdges);
      dH = dH.concat(pushEdges.flatMap(
        function (pushEdge)
        {
          return popEdges.map(function (popEdge) {return new Edge(pushEdge.source, new Unch(pushEdge.g.frame), popEdge.target)});
        }));
    }

//    try {
    while (true)
    {
      // epsilon edges
      if (dH.length > 0)
      {
        var h = dH.shift();
        if (!ecg.containsEdge(h))
        {
//          print("dH", h, ecg.edges.length);
          ecg = ecg.addEdge(h);
          var q = h.source;
          var q1 = h.target;
          ecg = ecg.addEdge(new Edge(q, null, q)).addEdge(new Edge(q1, null, q1));
          addEmpty(q, q1);
        }
      }
      // push, pop, unch edges
      else if (dE.length > 0)
      {
        var e = dE.shift();
        if (!etg.containsEdge(e))
        {
//          print("dE", e, etg.edges.length);
          var q = e.source;
          var g = e.g;
          var q1 = e.target;
          if (!etg.containsTarget(q1))
          {
            dS = dS.addLast(q1);
          }
          etg = etg.addEdge(e);
          ecg = ecg.addEdge(new Edge(q, null, q)).addEdge(new Edge(q1, null, q1));
          if (g.isPush)
          {
            addPush(q, g.frame, q1);
          }
          else if (g.isPop)
          {
            addPop(q, g.frame, q1);
          }
          else
          {
            addEmpty(q, q1);
          }
        }
      }
      // control states
      else if (dS.length > 0)
      {
        var q = dS.shift();
//        print("dS", q);
        ecg = ecg.addEdge(new Edge(q, null, q));
        sprout(q);
      }
      else
      {
        return {etg:etg, ecg:ecg, ss:ss};
      }
    }
  }

Pushdown.pushPredecessors =
  function (s, etg)
  {
    return etg.incoming(s).filter(function (e) {return e.g.isPush}).map(Edge.source);
  }

Pushdown.popSuccessors =
  function (s, etg)
  {
    return etg.outgoing(s).filter(function (e) {return e.g.isPop}).map(Edge.target);
  }

Pushdown.epsPopSuccessors =
  function (s, etg, ecg)
  {
    var etgSuccs = etg.outgoing(s).filter(function (e) {return !e.g.isPush}).map(Edge.target);
    var ecgSuccs = ecg.successors(s);
    return etgSuccs.concat(ecgSuccs);
  }

Pushdown.framePredecessors =
  function (s, frame, ecg)
  {
    return ecg.incoming(s).flatMap(
      function (h)
      {
        return (h.g && h.g.frame.equals(frame)) ? [h.source] : [];
      });
  }

Pushdown.preStackUntil =
  function (s, fe, etg, ecg)
  {
    var targets = HashSet.empty();
    var visited = HashSet.empty();
    var todo = etg.incoming(s);
    while (todo.length > 0)
    {
      var e = todo.shift();
      if (visited.contains(e))
      {
        continue;
      }
      visited = visited.add(e);
      if (fe(e))
      {
        targets = targets.add(e);
        break;
      }
      var q = e.source;
      var incomingEtg = etg.incoming(q).filter(function (edge) {return !edge.g.isPop});
      var incomingEcg = ecg.incoming(q);
      todo = todo.concat(incomingEtg).concat(incomingEcg);        
    }
    return {targets:targets,visited:visited};
  }

Pushdown.pathsBwTo =
  function (s, target, etg)
  {
    var todo = [s];
    var visited = HashSet.empty();
    var paths = HashSet.empty();
    while (todo.length > 0)
    {
      var q = todo.shift();
      if (q.equals(target) || visited.contains(q))
      {
        continue;
      }
      visited = visited.add(q);
      var incoming = etg.incoming(q);
      paths = paths.addAll(incoming);
      var qs = incoming.map(Edge.source);
      todo = todo.concat(qs);
    }
    return paths.values();
  }

Pushdown.valueFor =
  function (s, etg, ecg)
  {
    var popPredecessors = etg.incoming(s).flatMap(function (e) {return e.g.isPop ? [e.source] : []});
    var epsPredecessors = popPredecessors.flatMap(function (q) {return ecg.predecessors(q)});
    return epsPredecessors;
  }

Pushdown.prototype.analyze =
  function (ast, cesk, override)
  {
    var initial = cesk.inject(ast, override);
    var dsg = Pushdown.run(initial);
    return new Dsg(initial, dsg.etg, dsg.ecg, dsg.ss);
  }

function Dsg(initial, etg, ecg, ss)
{
  this.initial = initial;
  this.etg = etg;
  this.ecg = ecg;
  this.ss = ss;
}

Dsg.prototype.stepFwOver =
  function (s)
  {
    var successors = this.ecg.outgoing(s).flatMap(function (h) {return h.g ? [h.target] : []});
    return successors;
  }

Dsg.prototype.stepBwOver =
  function (s)
  {
    var predecessors = this.ecg.incoming(s).flatMap(function (h) {return h.g ? [h.source] : []});
    return predecessors;
  }

//Dsg.prototype.matchingPush =
//  function (e)
//  {
//    var frame = e.g.frame;
//    var qs = this.ecg.incoming(e.target).flatMap(function (h) {return (h.g && h.g.frame.equals(frame) ? [h.source] : []}));
//    return this.etg.outgoing.flatMap(function (e1) {return e1.g.isPush && e1.g.frame.equals(frame)});
//  }

Dsg.prototype.popValues = 
  function (s)
  {
    var targets = HashSet.empty();
    var visited = HashSet.empty();
    var todo = [s];
    while (todo.length > 0)
    {
      var q = todo.shift();
      if (visited.contains(q))
      {
        continue;
      }
      visited = visited.add(q);
      if (q.value)
      {
        targets = targets.add(q);
        continue;
      }
      todo = todo.concat(Pushdown.epsPopSuccessors(q, this.etg, this.ecg));
    }
    return targets.values();
  }

Dsg.prototype.values =
  function (s)
  {
    var qs = Pushdown.pushPredecessors(s, this.etg);
    var q1s = qs.flatMap(function (q) {return this.stepFwOver(q)}, this);
    return q1s.flatMap(function (q1) {return this.popValues(q1)}, this);
  }


Dsg.prototype.executions =
  function (s)
  {
    var edges = Pushdown.preStackUntil(s, function (e) {return e.source.fun}, this.etg, this.ecg).targets;
    return edges.values().map(Edge.source);
  }

Dsg.prototype.cflows =
  function (s)
  {
    var edges = Pushdown.preStackUntil(s, function () {return false}, this.etg, this.ecg).visited;
    return edges.values().flatMap(function (e) {return e.source.fun ? [e.source] : []});
  }

Dsg.prototype.declarations =
  function (s)
  {
    var name = s.node.name;
    var etg = this.etg;
    var ecg = this.ecg;
    var targets = HashSet.empty();
    var visited = HashSet.empty();
    var todo = [s];
    while (todo.length > 0)
    {
      var q = todo.shift();
      if (visited.contains(q))
      {
        continue;
      }
      visited = visited.add(q);
      if (q.node && q.node.type === "VariableDeclaration" && q.node.declarations[0].id.name === name)
      {
        targets = targets.add(q);
        continue;
      }
      var incoming = etg.incoming(q);
      todo = incoming.reduce(
        function (todo, e)
        {
          if (e.g.isPop && e.g.frame.isMarker)
          {
            return todo.concat(Pushdown.framePredecessors(q, e.g.frame, ecg));
          }
          return todo.addLast(e.source);
        }, todo);
    }
    return targets.values();
  }

