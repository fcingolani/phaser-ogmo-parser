class OgmoParser

  # Phaser integration

  @register: ()->
    unless Phaser.TilemapParser._parse?
      Phaser.Tilemap.OGMO = 'ogmo'
      Phaser.TilemapParser._parse = Phaser.TilemapParser.parse
      Phaser.TilemapParser.parse = @parse


  @unregister: ()->
    Phaser.TilemapParser.parse = Phaser.TilemapParser._parse
    delete Phaser.TilemapParser._parse
    delete Phaser.Tilemap.OGMO


  @parse: (game, oel_key, tileWidth, tileHeight, width, height)->
    oep_key = oel_key.split('.').shift() + '.oep'

    oep_exists = game.cache.checkXMLKey oep_key
    oel_exists = game.cache.checkXMLKey oel_key

    if oep_exists? and oel_exists?
      json = OgmoParser.toTiledJSON game, oel_key, oep_key
      Phaser.TilemapParser.parseTiledJSON json
    else
      Phaser.TilemapParser._parse(game, oel_key, tileWidth, tileHeight, width, height)


  @toTiledJSON: (game, oel, oep)->

    if typeof oel is 'string'
      oel = game.cache.getXML oel

    if typeof oep is 'string'
      oep = game.cache.getXML oep

    conf = @_parseConfig oep

    json = @_createJSON oel, conf

    json.tilesets = @_parseTilesets( oep.getElementsByTagName('Tileset'), conf )

    level_node = _element oel, 'level'

    for layer_node in level_node.children

      layer_type = conf.layers[layer_node.tagName].type

      if typeof @["_parse#{layer_type}"] is 'function'
        layer = @["_parse#{layer_type}"](layer_node, conf, json)

        if layer?
          json.layers.push layer


    return json


  # MAP

  @_createJSON: (oel, conf)->

    level_node = _element oel, 'level'

    level_width_px  = _attribute level_node, 'width'
    level_height_px = _attribute level_node, 'height'

    json = 
      orientation:  'orthogonal'
      version:      1
      width:        level_width_px // conf.tileWidth
      height:       level_height_px // conf.tileHeight
      tilewidth:    conf.tileWidth
      tileheight:   conf.tileHeight
      layers:       []
      tilesets:     []
      properties:   {}


  # TILESETS

  @_parseTilesets: (tileset_defs, conf)->
    tilesets = []
    tilesets.gids = {}
    first_gid = 1

    for tileset_def in tileset_defs

      tileset = @_parseTileset tileset_def, first_gid

      tilesets.gids[tileset.name] = first_gid
      first_gid += @_countTilesetTiles tileset

      tilesets.push tileset

    # fake tilesets for grid layers
    for layer_name, layer_conf of conf.layers when layer_conf.type is 'GridLayerDefinition'
      tileset = @_createTileset
        firstgid:     first_gid
        name:         layer_name
        imagewidth:   parseInt layer_conf.gridWidth
        imageheight:  parseInt layer_conf.gridWidth
        tilewidth:    parseInt layer_conf.gridWidth
        tileheight:   parseInt layer_conf.gridHeight

      tilesets.gids[tileset.name] = first_gid
      first_gid += 1

      tilesets.push tileset

    return tilesets


  @_createTileset: (props)->
    tileset =
      firstgid:     null
      name:         ''
      properties:   {}

      image:        ''
      imagewidth:   0
      imageheight:  0

      tilewidth:    0
      tileheight:   0
      tileproperties: {}

      spacing:      0
      margin:       0

    return Phaser.Utils.mixin props, tileset
    


  @_parseTileset: (tileset_def, first_gid)->

    tileset_name = _value tileset_def, 'Name'
    tileset_img = game.cache.getImage tileset_name

    tileset = @_createTileset
      firstgid:     first_gid
      name:         tileset_name

      image:        _value(tileset_def, 'FilePath')
      imagewidth:   parseInt tileset_img.width
      imageheight:  parseInt tileset_img.height

      tilewidth:    parseInt _value(tileset_def, 'Width')
      tileheight:   parseInt _value(tileset_def, 'Height')

      spacing:      parseInt _value(tileset_def, 'TileSep')


  @_countTilesetTiles: (tileset)->
    tileset_cols = tileset.imagewidth // tileset.tilewidth
    tileset_rows = tileset.imagewidth // tileset.tileheight
    parseInt( tileset_cols * tileset_rows )


  # LAYERS

  @_createLayer: (layer_node, json)->
    layer =
      name:     layer_node.tagName
      x:        0
      y:        0
      width:    json.width
      height:   json.height
      opacity:  1
      visible:  true

  @_parseGridLayerDefinition: (layer_node, conf, json)->
    layer = @_createLayer layer_node, json
    layer.type = 'tilelayer'

    layer.data = layer_node.innerHTML.trim().replace(/[^01]/g, '').split('')

    for i, v of layer.data
      layer.data[i] = parseInt v



    return layer

  @_parseTileLayerDefinition: (layer_node, conf, json)->
    layer = @_createLayer layer_node, json
    layer.type = 'tilelayer'
    
    layer_tileset = _attribute layer_node, 'tileset'
    layer.data = layer_node.innerHTML.trim().replace(/\n/g, ',').split(',')

    for i, v of layer.data
      layer.data[i] = json.tilesets.gids[layer_tileset] + parseInt v

    return layer

  @_parseEntityLayerDefinition: (layer_node, conf, json)->

    layer = @_createLayer layer_node, json
    layer.type = 'objectgroup'
    layer.objects = []

    for entity_node in layer_node.children

      entity = @_parseEntity entity_node, conf, json

      if entity?
        layer.objects.push entity

      entity_conf = conf.entities[entity_node.tagName]
      entity_attr = _attributes entity_node

      if entity_conf.drawMode is 'Image'
        # add and image layer JIC
        image_layer = @_createImageLayer entity, entity_conf, json
        json.layers.push image_layer

    return layer


  # ENTITIES

  @_createEntity: (entity_node, conf)->
    entity_conf = conf.entities[entity_node.tagName]
    entity_attr = _attributes entity_node

    properties = {}

    for attr_name, attr_value of entity_attr when entity_conf.values[attr_name]?
      entity_value = entity_conf.values[attr_name]
      properties[attr_name] = switch entity_value.type
        when 'IntValueDefinition' then parseInt attr_value
        else attr_value

    entity =
      type:   entity_attr.type  or entity_node.tagName
      x:      parseInt entity_attr.x
      y:      parseInt entity_attr.y
      height: 0
      width:  0
      rotation:   0
      visible:    true
      properties: properties

    if entity_attr.gid
      entity.gid = entity_attr.gid

    if entity_attr.name
      entity.name = entity_attr.name

    return entity

  @_parseEntity: (entity_node, conf, json)->

    entity = @_createEntity entity_node, conf

    entity_conf = conf.entities[entity_node.tagName]

    if entity_conf.nodesEnabled
      nodes_prop = @_entityNodesModes[entity_conf.nodesMode]

      unless nodes_prop?
        return _warn "Unsopported entity nodes DrawMode: #{entity_conf.nodesMode}"

      entity_nodes  = entity_node.getElementsByTagName('node')
      entity_points = @_parseEntityPointNodes entity_nodes
      entity[nodes_prop] = entity_points
    
    return entity

  @_entityNodesModes:
      Path:    'polyline'
      Circuit: 'polygon'

  @_parseEntityPointNodes: (entity_point_nodes, entity_x, entity_y)->
    entity_points = [{ x: 0, y: 0 }]

    for node in entity_point_nodes
      entity_points.push
        x: parseInt(_attribute( node, 'x' )) - entity_x
        y: parseInt(_attribute( node, 'y' )) - entity_y


  # ENTITIES

  @_createImageLayer: (entity, entity_conf, json)->

    image_layer = 
      name:     entity.name or entity_conf.name
      type:     "imagelayer"
      x:        entity.x
      y:        entity.y
      width:    json.width
      height:   json.height
      image:    entity_conf.imagePath
      opacity:  1
      visible:  true


  # CONFIG

  @_parseConfig: (oep)->

    first_layer_def = _element oep, 'LayerDefinition'

    unless oep._config?
      oep._config = 
        tileWidth:  parseInt _value(first_layer_def, 'Width')
        tileHeight: parseInt _value(first_layer_def, 'Height')
        layers:     @__createLayersConfig oep
        tilesets:   @_createTilesetsConfig oep
        entities:   @_createEntitiesConfig oep

    return oep._config

  @__createLayersConfig: (oep)->
    layers = {}

    for layer_def in oep.getElementsByTagName 'LayerDefinition'
      layer = 
        name:       _value      layer_def, 'Name'
        type:       _attribute  layer_def, 'xsi:type'
        exportMode: _value      layer_def, 'ExportMode'
        gridWidth:  _value      layer_def, 'Width'
        gridHeight: _value      layer_def, 'Height'
      
      layers[layer.name] = layer

    return layers

  @_createTilesetsConfig: (oep)->
    tilesets = {}

    for tileset_def in oep.getElementsByTagName 'Tileset'
      tileset =
        name:       _value      tileset_def, 'Name'
        path:       _value      tileset_def, 'FilePath'
        tileWidth:  _value      tileset_def, 'Width'
        tileHeight: _value      tileset_def, 'Height'
        spacing:    _value      tileset_def, 'TileSep'
        margin:     0
        properties: {}

      tilesets[tileset.name] = tileset

    return tilesets

  @_createEntitiesConfig: (oep)->
    entities = {}

    for entity_def in oep.getElementsByTagName 'EntityDefinition'
      image_def = _element entity_def, 'ImageDefinition'
      nodes_def = _element entity_def, 'NodesDefinition'

      values = {}

      for value_def in entity_def.getElementsByTagName 'ValueDefinition'
        values[_attribute(value_def, 'Name')] =
          type: _attribute value_def, 'xsi:type'

      entity =
        name:         _attribute  entity_def, 'Name'
        drawMode:     _attribute  image_def, 'DrawMode'
        imagePath:    _attribute  image_def, 'ImagePath'
        nodesEnabled: 'true' == _attribute nodes_def, 'Enabled'
        nodesMode:    _attribute nodes_def, 'DrawMode' 
        values:       values

      entities[entity.name] = entity

    return entities
    

  # HELPERS

  _warn = (msg)->
    console.warn "[OgmoParser] #{msg}"
    return null

  _attributes = (node)->
    unless node._attributes?
      node._attributes = {}

      for attr in node.attributes
        node._attributes[attr.name] = attr.value

    return node._attributes

  _element = (node, name)->
    e = node.getElementsByTagName(name)
    if e.length > 0 then e[0] else null

  _attribute = (node, name, def = null)->
    if node? then _attributes( node )[name] else def

  _value = (node, name, def = null)->
    if node? and e = _element(node, name) then e.innerHTML else def