var OgmoParser;

OgmoParser = (function() {
  var _attribute, _attributes, _element, _value, _warn;

  function OgmoParser() {}

  OgmoParser.register = function() {
    if (Phaser.TilemapParser._parse == null) {
      Phaser.Tilemap.OGMO = 'ogmo';
      Phaser.TilemapParser._parse = Phaser.TilemapParser.parse;
      return Phaser.TilemapParser.parse = this.parse;
    }
  };

  OgmoParser.unregister = function() {
    Phaser.TilemapParser.parse = Phaser.TilemapParser._parse;
    delete Phaser.TilemapParser._parse;
    return delete Phaser.Tilemap.OGMO;
  };

  OgmoParser.parse = function(game, oel_key, tileWidth, tileHeight, width, height) {
    var json, oel_exists, oep_exists, oep_key;
    oep_key = oel_key.split('.').shift() + '.oep';
    oep_exists = game.cache.checkXMLKey(oep_key);
    oel_exists = game.cache.checkXMLKey(oel_key);
    if ((oep_exists != null) && (oel_exists != null)) {
      json = OgmoParser.toTiledJSON(game, oel_key, oep_key);
      return Phaser.TilemapParser.parseTiledJSON(json);
    } else {
      return Phaser.TilemapParser._parse(game, oel_key, tileWidth, tileHeight, width, height);
    }
  };

  OgmoParser.toTiledJSON = function(game, oel, oep) {
    var conf, json, layer, layer_node, layer_type, level_node, _i, _len, _ref;
    if (typeof oel === 'string') {
      oel = game.cache.getXML(oel);
    }
    if (typeof oep === 'string') {
      oep = game.cache.getXML(oep);
    }
    conf = this._parseConfig(oep);
    json = this._createJSON(oel, conf);
    json.tilesets = this._parseTilesets(oep.getElementsByTagName('Tileset'), conf);
    level_node = _element(oel, 'level');
    _ref = level_node.children;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      layer_node = _ref[_i];
      layer_type = conf.layers[layer_node.tagName].type;
      if (typeof this["_parse" + layer_type] === 'function') {
        layer = this["_parse" + layer_type](layer_node, conf, json);
        if (layer != null) {
          json.layers.push(layer);
        }
      }
    }
    return json;
  };

  OgmoParser._createJSON = function(oel, conf) {
    var json, level_height_px, level_node, level_width_px;
    level_node = _element(oel, 'level');
    level_width_px = _attribute(level_node, 'width');
    level_height_px = _attribute(level_node, 'height');
    return json = {
      orientation: 'orthogonal',
      version: 1,
      width: Math.floor(level_width_px / conf.tileWidth),
      height: Math.floor(level_height_px / conf.tileHeight),
      tilewidth: conf.tileWidth,
      tileheight: conf.tileHeight,
      layers: [],
      tilesets: [],
      properties: {}
    };
  };

  OgmoParser._parseTilesets = function(tileset_defs, conf) {
    var first_gid, layer_conf, layer_name, tileset, tileset_def, tilesets, _i, _len, _ref;
    tilesets = [];
    tilesets.gids = {};
    first_gid = 1;
    for (_i = 0, _len = tileset_defs.length; _i < _len; _i++) {
      tileset_def = tileset_defs[_i];
      tileset = this._parseTileset(tileset_def, first_gid);
      tilesets.gids[tileset.name] = first_gid;
      first_gid += this._countTilesetTiles(tileset);
      tilesets.push(tileset);
    }
    _ref = conf.layers;
    for (layer_name in _ref) {
      layer_conf = _ref[layer_name];
      if (!(layer_conf.type === 'GridLayerDefinition')) {
        continue;
      }
      tileset = this._createTileset({
        firstgid: first_gid,
        name: layer_name,
        imagewidth: parseInt(layer_conf.gridWidth),
        imageheight: parseInt(layer_conf.gridWidth),
        tilewidth: parseInt(layer_conf.gridWidth),
        tileheight: parseInt(layer_conf.gridHeight)
      });
      tilesets.gids[tileset.name] = first_gid;
      first_gid += 1;
      tilesets.push(tileset);
    }
    return tilesets;
  };

  OgmoParser._createTileset = function(props) {
    var tileset;
    tileset = {
      firstgid: null,
      name: '',
      properties: {},
      image: '',
      imagewidth: 0,
      imageheight: 0,
      tilewidth: 0,
      tileheight: 0,
      tileproperties: {},
      spacing: 0,
      margin: 0
    };
    return Phaser.Utils.mixin(props, tileset);
  };

  OgmoParser._parseTileset = function(tileset_def, first_gid) {
    var tileset, tileset_img, tileset_name;
    tileset_name = _value(tileset_def, 'Name');
    tileset_img = game.cache.getImage(tileset_name);
    return tileset = this._createTileset({
      firstgid: first_gid,
      name: tileset_name,
      image: _value(tileset_def, 'FilePath'),
      imagewidth: parseInt(tileset_img.width),
      imageheight: parseInt(tileset_img.height),
      tilewidth: parseInt(_value(tileset_def, 'Width')),
      tileheight: parseInt(_value(tileset_def, 'Height')),
      spacing: parseInt(_value(tileset_def, 'TileSep'))
    });
  };

  OgmoParser._countTilesetTiles = function(tileset) {
    var tileset_cols, tileset_rows;
    tileset_cols = Math.floor(tileset.imagewidth / tileset.tilewidth);
    tileset_rows = Math.floor(tileset.imagewidth / tileset.tileheight);
    return parseInt(tileset_cols * tileset_rows);
  };

  OgmoParser._createLayer = function(layer_node, json) {
    var layer;
    return layer = {
      name: layer_node.tagName,
      x: 0,
      y: 0,
      width: json.width,
      height: json.height,
      opacity: 1,
      visible: true
    };
  };

  OgmoParser._parseGridLayerDefinition = function(layer_node, conf, json) {
    var i, layer, v, _ref;
    layer = this._createLayer(layer_node, json);
    layer.type = 'tilelayer';
    layer.data = layer_node.innerHTML.trim().replace(/[^01]/g, '').split('');
    _ref = layer.data;
    for (i in _ref) {
      v = _ref[i];
      layer.data[i] = parseInt(v);
    }
    return layer;
  };

  OgmoParser._parseTileLayerDefinition = function(layer_node, conf, json) {
    var i, layer, layer_tileset, v, _ref;
    layer = this._createLayer(layer_node, json);
    layer.type = 'tilelayer';
    layer_tileset = _attribute(layer_node, 'tileset');
    layer.data = layer_node.innerHTML.trim().replace(/\n/g, ',').split(',');
    _ref = layer.data;
    for (i in _ref) {
      v = _ref[i];
      layer.data[i] = json.tilesets.gids[layer_tileset] + parseInt(v);
    }
    return layer;
  };

  OgmoParser._parseEntityLayerDefinition = function(layer_node, conf, json) {
    var entity, entity_attr, entity_conf, entity_node, image_layer, layer, _i, _len, _ref;
    layer = this._createLayer(layer_node, json);
    layer.type = 'objectgroup';
    layer.objects = [];
    _ref = layer_node.children;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      entity_node = _ref[_i];
      entity = this._parseEntity(entity_node, conf, json);
      if (entity != null) {
        layer.objects.push(entity);
      }
      entity_conf = conf.entities[entity_node.tagName];
      entity_attr = _attributes(entity_node);
      if (entity_conf.drawMode === 'Image') {
        image_layer = this._createImageLayer(entity, entity_conf, json);
        json.layers.push(image_layer);
      }
    }
    return layer;
  };

  OgmoParser._createEntity = function(entity_node, conf) {
    var attr_name, attr_value, entity, entity_attr, entity_conf, entity_value, properties;
    entity_conf = conf.entities[entity_node.tagName];
    entity_attr = _attributes(entity_node);
    properties = {};
    for (attr_name in entity_attr) {
      attr_value = entity_attr[attr_name];
      if (!(entity_conf.values[attr_name] != null)) {
        continue;
      }
      entity_value = entity_conf.values[attr_name];
      properties[attr_name] = (function() {
        switch (entity_value.type) {
          case 'IntValueDefinition':
            return parseInt(attr_value);
          default:
            return attr_value;
        }
      })();
    }
    entity = {
      type: entity_attr.type || entity_node.tagName,
      x: parseInt(entity_attr.x),
      y: parseInt(entity_attr.y),
      height: 0,
      width: 0,
      rotation: 0,
      visible: true,
      properties: properties
    };
    if (entity_attr.gid) {
      entity.gid = entity_attr.gid;
    }
    if (entity_attr.name) {
      entity.name = entity_attr.name;
    }
    return entity;
  };

  OgmoParser._parseEntity = function(entity_node, conf, json) {
    var entity, entity_conf, entity_nodes, entity_points, nodes_prop;
    entity = this._createEntity(entity_node, conf);
    entity_conf = conf.entities[entity_node.tagName];
    if (entity_conf.nodesEnabled) {
      nodes_prop = this._entityNodesModes[entity_conf.nodesMode];
      if (nodes_prop == null) {
        return _warn("Unsopported entity nodes DrawMode: " + entity_conf.nodesMode);
      }
      entity_nodes = entity_node.getElementsByTagName('node');
      entity_points = this._parseEntityPointNodes(entity_nodes);
      entity[nodes_prop] = entity_points;
    }
    return entity;
  };

  OgmoParser._entityNodesModes = {
    Path: 'polyline',
    Circuit: 'polygon'
  };

  OgmoParser._parseEntityPointNodes = function(entity_point_nodes, entity_x, entity_y) {
    var entity_points, node, _i, _len, _results;
    entity_points = [
      {
        x: 0,
        y: 0
      }
    ];
    _results = [];
    for (_i = 0, _len = entity_point_nodes.length; _i < _len; _i++) {
      node = entity_point_nodes[_i];
      _results.push(entity_points.push({
        x: parseInt(_attribute(node, 'x')) - entity_x,
        y: parseInt(_attribute(node, 'y')) - entity_y
      }));
    }
    return _results;
  };

  OgmoParser._createImageLayer = function(entity, entity_conf, json) {
    var image_layer;
    return image_layer = {
      name: entity.name || entity_conf.name,
      type: "imagelayer",
      x: entity.x,
      y: entity.y,
      width: json.width,
      height: json.height,
      image: entity_conf.imagePath,
      opacity: 1,
      visible: true
    };
  };

  OgmoParser._parseConfig = function(oep) {
    var first_layer_def;
    first_layer_def = _element(oep, 'LayerDefinition');
    if (oep._config == null) {
      oep._config = {
        tileWidth: parseInt(_value(first_layer_def, 'Width')),
        tileHeight: parseInt(_value(first_layer_def, 'Height')),
        layers: this.__createLayersConfig(oep),
        tilesets: this._createTilesetsConfig(oep),
        entities: this._createEntitiesConfig(oep)
      };
    }
    return oep._config;
  };

  OgmoParser.__createLayersConfig = function(oep) {
    var layer, layer_def, layers, _i, _len, _ref;
    layers = {};
    _ref = oep.getElementsByTagName('LayerDefinition');
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      layer_def = _ref[_i];
      layer = {
        name: _value(layer_def, 'Name'),
        type: _attribute(layer_def, 'xsi:type'),
        exportMode: _value(layer_def, 'ExportMode'),
        gridWidth: _value(layer_def, 'Width'),
        gridHeight: _value(layer_def, 'Height')
      };
      layers[layer.name] = layer;
    }
    return layers;
  };

  OgmoParser._createTilesetsConfig = function(oep) {
    var tileset, tileset_def, tilesets, _i, _len, _ref;
    tilesets = {};
    _ref = oep.getElementsByTagName('Tileset');
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      tileset_def = _ref[_i];
      tileset = {
        name: _value(tileset_def, 'Name'),
        path: _value(tileset_def, 'FilePath'),
        tileWidth: _value(tileset_def, 'Width'),
        tileHeight: _value(tileset_def, 'Height'),
        spacing: _value(tileset_def, 'TileSep'),
        margin: 0,
        properties: {}
      };
      tilesets[tileset.name] = tileset;
    }
    return tilesets;
  };

  OgmoParser._createEntitiesConfig = function(oep) {
    var entities, entity, entity_def, image_def, nodes_def, value_def, values, _i, _j, _len, _len1, _ref, _ref1;
    entities = {};
    _ref = oep.getElementsByTagName('EntityDefinition');
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      entity_def = _ref[_i];
      image_def = _element(entity_def, 'ImageDefinition');
      nodes_def = _element(entity_def, 'NodesDefinition');
      values = {};
      _ref1 = entity_def.getElementsByTagName('ValueDefinition');
      for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
        value_def = _ref1[_j];
        values[_attribute(value_def, 'Name')] = {
          type: _attribute(value_def, 'xsi:type')
        };
      }
      entity = {
        name: _attribute(entity_def, 'Name'),
        drawMode: _attribute(image_def, 'DrawMode'),
        imagePath: _attribute(image_def, 'ImagePath'),
        nodesEnabled: 'true' === _attribute(nodes_def, 'Enabled'),
        nodesMode: _attribute(nodes_def, 'DrawMode'),
        values: values
      };
      entities[entity.name] = entity;
    }
    return entities;
  };

  _warn = function(msg) {
    console.warn("[OgmoParser] " + msg);
    return null;
  };

  _attributes = function(node) {
    var attr, _i, _len, _ref;
    if (node._attributes == null) {
      node._attributes = {};
      _ref = node.attributes;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        attr = _ref[_i];
        node._attributes[attr.name] = attr.value;
      }
    }
    return node._attributes;
  };

  _element = function(node, name) {
    var e;
    e = node.getElementsByTagName(name);
    if (e.length > 0) {
      return e[0];
    } else {
      return null;
    }
  };

  _attribute = function(node, name, def) {
    if (def == null) {
      def = null;
    }
    if (node != null) {
      return _attributes(node)[name];
    } else {
      return def;
    }
  };

  _value = function(node, name, def) {
    var e;
    if (def == null) {
      def = null;
    }
    if ((node != null) && (e = _element(node, name))) {
      return e.innerHTML;
    } else {
      return def;
    }
  };

  return OgmoParser;

})();
