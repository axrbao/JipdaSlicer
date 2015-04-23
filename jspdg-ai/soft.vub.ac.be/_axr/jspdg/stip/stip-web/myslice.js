function myslice(graphs, src)
{
  //console.log("srcsrc", src);
  
  //sorting the edges
  var edges = graphs.DSG.etg.edges().sort(function (link1, link2) {return link1.index - link2.index});

  var slicing_nodes = [];
  var stg_nodes = [];

  var program = { 'type' : 'Program',
          'body' : [] };
  //collecting all the nodes
  for(var i = 0; i < edges.length; i++){
    console.log("edge", i, edges[i]);
    stg_nodes[i] = edges[i].source;
    slicing_nodes[i] = graphs.JTC.getNode(edges[i].source);
    console.log("slicing node", i, slicing_nodes[i]);    
    console.log("stg node", i, stg_nodes[i]);
    if(slicing_nodes[i][0] && slicing_nodes[i][0].parsenode)
      console.log("slicing code", slicing_nodes[i][0].parsenode.toString());
    
    //nodes[i].parsenode = nodes[i].node
  }
  
  getStartNode(src, program, edges, stg_nodes, slicing_nodes);

  
  return program;
  // console.log("nodes", nodes);
  // for(var i = 1; i < nodes.length; i ++){
  //   if(nodes[i].parsenode)
  //     console.log("a-----",toPlainJS(nodes,nodes[i]));  
    
    
  // }
}


//append a code snipit to program
function append_to_program(program, slicing){
  if(slicing.parsednode) {
    var found = false;
    for(var i = 0; i < program.body.length; i ++){
      if(program.body[i].range[0] <= slicing.parsednode.range[0] && program.body[i].range[1] >= slicing.parsednode.range[1])
        found = true;
    }
    if(!found)
      program.body = program.body.concat(slicing.parsednode);
  }
}


function getStartNode(src, program, edges, stg_nodes, slicing_nodes){
  var line_num = parseInt($("#line_number").val()); 
  var var_name = $("#var_name").val();
  console.log(line_num, var_name);
  var lines = (src + "\n").split('\n');

  console.log(lines, "line select:", lines[line_num - 1]);
  //calculate the range of the current line;
  var line_range = [0, 0];
  for(var i = 0; i < line_num - 1; i++){
    line_range[0] = line_range[0] + lines[i].length + 1;
  }
  line_range[1] = line_range[0] + lines[line_num - 1].length - 1;

  console.log("range of the selected line:" , line_range);

  var if_stack = [];
  for(var i = 1; i < slicing_nodes.length; i ++){
    if(slicing_nodes[i][0] && slicing_nodes[i][0].parsenode) 
      console.log(i, "slicing_node", slicing_nodes[i][0].parsenode.toString());
      
    
    if(stg_nodes[i].node){
      console.log(i, "stg_node", stg_nodes[i].node, stg_nodes[i].node.toString());
      if(stg_nodes[i].node.type == "IfStatement"){
         if(stg_nodes[i].node.range[0] <= line_range[0]
          && stg_nodes[i].node.range[1] >= line_range[1]){  //selected line is in this if statement
            if_stack.push(i);
            console.log("pushing if statement", i);

            slicing_if_statement(stg_nodes, i);
            
         }
      }

      //TODO: pop the element in if_stack if the current node is not in the if_block
    }
    
    if(slicing_nodes[i][0] && slicing_nodes[i][0].parsenode 
      && slicing_nodes[i][0].parsenode.range[0] >= line_range[0]
      && slicing_nodes[i][0].parsenode.range[1] <= line_range[1]){

      console.log("dep:", i, stg_nodes[i]);
      var skip = collect_dep(stg_nodes[i], program, edges,stg_nodes,slicing_nodes);
      
      append_to_program(program, toPlainJS(slicing_nodes,stg_nodes[i], slicing_nodes[i][0]));  
      i = i + skip;
    }else if(if_stack.length > 0 && stg_nodes[i] && stg_nodes[i].node 
      && stg_nodes[i].node.range[0] >= line_range[0]
      && stg_nodes[i].node.range[1] <= line_range[1]){

      console.log("dep for statement in if block:", i, stg_nodes[i], if_stack);
      for(var if_node_index = 0; if_node_index < if_stack.length; if_node_index++){
        collect_dep(stg_nodes[if_stack[if_node_index]], program, edges,stg_nodes,slicing_nodes);
      }
      //var if_node_index = if_stack.pop(); //top node in if_stack
      
      //dep in if block
      if(stg_nodes[i].node.type == "Identifier"){
          var dep_var = stg_nodes[i].node.name;
          console.log("dep var found in if block", dep_var);
          var dep_node = lookup_dep_node_by_var(stg_nodes, i, dep_var);
          if(!dep_node){
            dep_node = lookup_dep_node_by_func_name(stg_nodes,i,dep_var);
          }

          if(dep_node){
            console.log("dep node found from an if block", dep_node);
            slice_dep_node(dep_node, program, edges, stg_nodes, slicing_nodes);
          }
      }
      //i = if_node_index + skip;
      if(slicing_nodes[0][0])
         append_to_program(program, toPlainJS(slicing_nodes,stg_nodes[if_stack[0]], slicing_nodes[if_stack[0]][0]));  
      else
        append_to_program(program, toPlainJS(slicing_nodes,stg_nodes[if_stack[0]], slicing_nodes[if_stack[0]][0])); 
      
    }
      
    
  }
}

function collect_dep(stg_node, program, edges,stg_nodes,slicing_nodes){
   for(var i = 0; i < edges.length; i++){
    if(edges[i].source == stg_node){
      var start_edge = edges[i];
      console.log("start_edge", start_edge);
      var tag = start_edge.g.frame.node.tag;
      //looking for end_edge first turn
      var node_count = 0;
      for(var j = i + 1; j < edges.length; j++){
        if(edges[j].g && edges[j].g.frame && edges[j].g.frame.node && edges[j].g.frame.node.tag == tag){
          node_count = j - i;
          break;
        }
      }
      if(node_count == 0)
        return 0; //this node does not depend any other node
      //looking for end_edge
      for(var j = i + 1; j < edges.length; j++){
        console.log("found dep edge:", edges[j]);
        if(edges[j].marks && edges[j].marks[0]){
          var mark = edges[j].marks[0];
          var dep_var = mark.address.context.cvalue;
          var base = mark.address.base.base;
          console.log("dep var found!!", dep_var);
          var dep_node = lookup_dep_node_by_var(stg_nodes, j, dep_var,base);
          if(!dep_node){
            dep_node = lookup_dep_node_by_func_name(stg_nodes,j,dep_var);
          }

          if(dep_node){
            console.log("dep node found", dep_node);
            slice_dep_node(dep_node, program, edges, stg_nodes, slicing_nodes);
          }
        }
        if(edges[j].g && edges[j].g.frame && edges[j].g.frame.node && edges[j].g.frame.node.tag == tag){
          return j - i;
        }
      }
      return 0;
    }
  }
}

function slice_dep_node(dep_node, program, edges, stg_nodes, slicing_nodes){
  for(var i = 0; i < stg_nodes.length; i++){
    if(dep_node == stg_nodes[i]){
      collect_dep(dep_node, program, edges, stg_nodes, slicing_nodes);
      append_to_program(program, toPlainJS(slicing_nodes,stg_nodes[i], slicing_nodes[i][0]));
    }
  }
}

function lookup_dep_node_by_var(stg_nodes, start_index, var_name, base){

  for(var i = start_index; i > 0; i--){
    if(stg_nodes[i].node){
      var parsenode = stg_nodes[i].node;
      if(parsenode.declarations){
        for(var j = 0; j < parsenode.declarations.length; j++){
          if(parsenode.declarations[j].id.name == var_name){
            if(stg_nodes[i].benva && stg_nodes[i].benva.base == base)
              console.log("possible dep var nodes", stg_nodes[i])
          }
        }
      }
    }
  } 
  for(var i = start_index; i > 0; i--){
    if(stg_nodes[i].node){
      var parsenode = stg_nodes[i].node;
      if(parsenode.declarations){
        for(var j = 0; j < parsenode.declarations.length; j++){
          if(parsenode.declarations[j].id.name == var_name){
            if(stg_nodes[i].benva && stg_nodes[i].benva.base == base)            
              return stg_nodes[i];
          }
        }
      }
    }
  } 
  return false;
}

function slicing_if_statement(stg_nodes, if_node_index){
  var tag = stg_nodes[if_node_index].node.tag;
  //search for ifkont,  which is the result of the binary expression for this if-statement
  for(var i = if_node_index+1; i < stg_nodes.length; i ++){
    if(stg_nodes[i].frame && stg_nodes[i].frame.node
      && stg_nodes[i].frame.node.type == "IfStatement" && stg_nodes[i].frame.node.tag == tag){
      if(stg_nodes[i].value.prim.cvalue == true){
        //if true
        stg_nodes[if_node_index].node.alternate = null; //cut the "else" block;

      }else{
        stg_nodes[if_node_index].node.consequent.type = "BlockStatement";
        stg_nodes[if_node_index].node.consequent.body = [];
      }
    }
  }
}


function lookup_dep_node_by_func_name(stg_nodes, start_index, var_name){

  for(var i = 0; i < stg_nodes.length; i++){  //search all the code to find the func
    if(stg_nodes[i].node){
      var parsenode = stg_nodes[i].node;
      if(parsenode.type=="FunctionDeclaration" && parsenode.id && parsenode.id.name==var_name){
        
            return stg_nodes[i];
          
      }
    }
  } 
  return false;
}

function toPlainJS(slicednodes,stg_node, node) {
  var parsenode;
  if(node.parsenode)
    parsenode = node.parsenode;
  else{
    node = stg_node;
    node.parsenode = node.node;
  }
  var scopeInfo = Ast.scopeInfo(node.parsenode),
      parent = Ast.hoist(scopeInfo).parent(node.parsenode,graphs.AST);
  if(parent && parent.type === "ReturnStatement") {
    node.parsenode = parent
  }
  if(parent && parent.type === "ExpressionStatement" && node.parsenode.type != "CallExpression") {
    node.parsenode = parent
  }
  console.log("SLICE("+node.parsenode.type+") " + node.parsenode);
  switch (node.parsenode.type) {
      case "VariableDeclaration": 
    return sliceVarDecl(slicednodes,node);
    case "FunctionExpression":
      return sliceFunExp(slicednodes,node);
    case "FunctionDeclaration":
      return sliceFuncDecl(slicednodes,node);
    case "BlockStatement":
    return sliceBlockStm(slicednodes,node);
    case "CallExpression":
      return sliceCallExp(slicednodes,node);
    case "BinaryExpression":
      return {};
    default: 
      return new Sliced(slicednodes,node,node.parsenode);
    }
}
function sliceFuncDecl(slicednodes,node) {
  return new Sliced([],node,node.parsenode);
}

function sliceVarDecl(slicednodes,node) {

  return new Sliced([],node,node.parsenode);
}