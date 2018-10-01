import React from 'react';
import ReactDOM from 'react-dom';
import _ from 'lodash';

// Source: https://github.com/coatue-oss/react2angular and heavenly edited by pouja.nikray@42.nl

/**
* Converts a react component to an angular directive.
* @param options.bindings The bindings are the same as you would define bindings in angular.
  'className' is a special binding which will be maped to 'class'.
* @param options.DI Allows you to specify which angular stuff you want injected.
* @param options.require The require object, currently only tested with ngModel
* @param options.id (Optional) An identifier which could be used for debugging
* @param options.hasChild Sets the transclude property, if the transclude property is falsy then it assumes
* only a single transcluded child is expected. Otherwise see transclude property
* @param options.transclude A hashmap as given when using angular directive. It will transclude every
* value and if it is not empty it will assign it to the value. So if {left: ?leftDiv} is given it will try
* to compile the <left-div> and set it to the prop 'left' of  the component.
 */
export default function react2angular(Class, {bindings, DI, require, hasChild, transclude, id}) {
  const hasTranscludeMap = transclude && typeof transclude === 'object';
  const hasTransclusion = hasChild || hasTranscludeMap;

  // set up the dependency names
  const coreDependencies = ['$element', '$timeout'];
  const transcludeDependencies = ['$transclude', '$compile', '$scope'];
  const dependencyNames = [];

  dependencyNames.push(...coreDependencies);

  if (hasTransclusion) {
    dependencyNames.push(...transcludeDependencies);
  }

  if (DI && DI.length) {
    dependencyNames.push(...DI);
  }

  const withTimeout = hasTransclusion || (require && Object.keys(require).length > 0);

  return {
    bindings: bindings,
    // Kinda ugly, but angular expects a hashmap, thruthy value or a false value
    transclude: transclude || !!hasChild,
    replace: true,
    require: require || {},
    controller: [...dependencyNames, class {
      constructor(...dependencies) {
        this.props = {};

        // some bindings are not passed through the onChanges, for example function bindings
        _.map(bindings, (value, key) => key)
          .filter((name) => this[name])
          .forEach((name) => {
            if (name === 'class') {
              this.props.className = this.class;
            } else {
              this.props[name] = this[name];
            }
        });

        this.__isFirstRender = true;

        this.$element = dependencies[0];
        this.$timeout = dependencies[1];

        this.compileTransclusions(dependencies);

        // set the DI on 'this.props'
        const offset = (hasTransclusion) ? coreDependencies.length + transcludeDependencies.length : coreDependencies.length;
        dependencies
          .splice(offset, dependencies.length)
          .forEach((value, idx) => {
            this.props[DI[idx]] = value;
          });
      }

      /**
       * Angular lifecycle method.
       * Re-assigneds the changes props for the react component and call render.
       * React will ensure that it will not remove and re-attach the react component,
       * but it will as expected call the componentwillreceiveprops method.
       * @param {any} changes
       */
      $onChanges(changes) {
        const newProps = _.mapValues(changes, 'currentValue');
        const nextProps = _.assign({}, this.props, newProps);

        if (this.__isFirstRender) {
          // we have to wait a digest cycle before we can add listeners
          if (this.ngModel) {
            this.ngModel.$viewChangeListeners.push(() => {
              this.render();
            });
          }
          this.__isFirstRender = false;
        }

        _.assign(this, {
          props: nextProps
        });
        this.render();
      }

      /**
       * Compiles all the necessary angular child nodes if there is any transclusion.
       * If there is only a single child (aka transcludeMap is false and hasChild is true),
       * it will compile the child node and set the output (string) to this.compiled.
       * Otherwise it will map the value (the html name) to the key (the prop name to be bind to).
       * @param {String[]} dependencies The list of injected angular dependecies, expects: [transclude, compile and scope]
       */
      compileTransclusions(dependencies) {
        if (!hasTransclusion) {
          return;
        }

        const $transclude = dependencies[3];
        const $compile = dependencies[4];
        const $scope = dependencies[5];

        // We are using $transclude so that we get the correct inner html to render.
        // Using $compile direct on the contents can be messy and can give incorrect results.

        if (hasTranscludeMap) {
          this.compiled = {};
          _.map(transclude, (htmlName, propName) => {
            $transclude((clone) => {
              // compile all nodes and then filter on nodetype
              this.compiled[propName] = $compile(clone)($scope)[0];
            }, null, strip(htmlName));
          });
        } else {
          $transclude((clone) => {
            this.compiled = $compile(clone)($scope);
          });
        }
      }

      /**
       * Maps the compiled nodes (if hasTransclusion and hasTranscludeMap are true) to
       * given prop names.
       * If only a single child is expected (hasTransclusion true and hasChild true) it will map
       * it to children props.
       */
      setTransclusions() {
        if (!hasTransclusion) {
          return;
        }

        if (hasTranscludeMap) {
          _(this.compiled)
            .filter(compiled => !!compiled.tagName)
            .each(this.compiled, (compiled, propName) => {
              this.props[propName] = elementToReact(compiled, propName);
            })
            .value();
        } else {
          this.props.children = nodesToReact(this.compiled);
        }
      }

      render() {
        if (withTimeout) {
          // We only need timeout if we have children to render or when ngModel is used
          this.$timeout(() => {
            this.setTransclusions();

            // set all the 'required' controllers
            _.map(require, (value, key) => this.props[key] = this[key]);

            this.renderInstant();
          });
        } else {
          this.renderInstant();
        }
      }

      renderInstant() {
        // Rename the className binding to class
        if (this.props.class) {
          this.props.className = this.props.class;
        }

        // render the react element
        ReactDOM.render(React.createElement(Class, Object.assign({}, this.props)), this.$element[0]);
      }

      $onDestroy() {
        ReactDOM.unmountComponentAtNode(this.$element[0]);
      }

    }]
  };
}

// basically needed to strip out the question mark in the transclude object
function strip(s) {
  return s.replace('?', '');
}

/**
 * Converts the attributes to key value pairs object.
 * @param {Node} node A DOM node
 */
function getAttributes(node) {
  let attrs = {};
  _.each(node.attributes, (value, key) => {
    const attr = node.attributes[key];
    attrs[attr.name] = attr.value;
  });
  return attrs;
}

/**
 * Renders the DOM NodeList (see mdn) to react components.
 * It only renders the text and element nodes to React components.
 * @param {NodeList} nodes
 */
function nodesToReact(nodes) {
  if (!nodes || nodes.length === 0) {
    return null;
  }

  // Using es6 spread operator because the input is a NodeList not an array
  return [...nodes]
    .map((node, key) => {
      if (node.nodeType === 1) {
        return elementToReact(node, key);
      } else if (node.nodeType === 3) {
        return node.textContent;
      }
      return null;
    })
    .filter(Boolean);
}

/**
 * Converts the attributes map to be useful by react.
 * Strips out all angular attributes and renames attributes
 * to make it React friendly (aka class -> className).
 * @param {StringMap} attributes
 */
function toReactAttributes(attributes) {
  // TODO use wildcards otherwise this will grow exp
  const filters = ['ng-show'];
  return _(attributes)
    .toPairs()
    .filter(pair => {
      return filters.every(filter => filter !== pair[0]);
    })
    .map(pair => {
      if (pair[0] === 'class') {
        pair[0] = 'className';
      }
      return pair;
    })
    .fromPairs()
    .value();
}

/**
 * Assumes that the given node is an Element or Text node,
 * and if it is a text element it will become a <div>.
 * Converts it to a react component.
 * @param {Node} node
 */
function elementToReact(node, key) {
  const tagName = node.tagName.toLowerCase();
  return React.createElement(tagName, {
    ...toReactAttributes(getAttributes(node)),
    dangerouslySetInnerHTML: {
      __html: node.innerHTML
    },
    key: `idx-${tagName}-${key}`
  });
}
