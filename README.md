# React2Angular

In the lieu of growing React library a need was created to transform Angular 1.x projects to React.
There are two ways to peform such transition, one rewrite page by page or (with this code) rewrite component by component.  

This is inspired by https://github.com/coatue-oss/react2angular  but heavily edited to 
 * perform transclusion
 * use angular DI (to access services and factories for example)
 * use ngModel

# Examples
## Simple Example
Angular:
```javascript
'use strict';

angular.module('myApp')
  .component('offlineOrNotModal', {
    template: `
      <div class="modal-header">
      <h2 class="modal-title">
        Offline
      </h2>
    </div>
    <div class="modal-body">
      <img class="img-responsive" src="/images/offline.png"/>
    </div>
   `
  });
```

React2Angular version:
```javascript
//@flow

import React, { Component } from 'react';
import react2angular from '../path/to/react2angular.react';

export default class OfflineOrNotModal extends Component {
  render() {
    return (
      <div>
        <div className="modal-header">
          <h2 className="modal-title" style={{ "text-align": "center" }}>
            Offline
          </h2>
        </div>
        <div className="modal-body clearfix">
          <img className="img-responsive" src="/images/offline.png"/>
        </div>
      </div>
    );
  };
};

angular.module('myApp')
.component('offlineOrNotModal', react2angular(OfflineOrNotModal, {
    bindings: {},
    id: 'offline-or-not-modal',
    hasChild: false
}));
```

## Example DI
Angular:
```html
<img
  ng-if="applicationLogoController.logoPath"
  ng-src="{{ applicationLogoController.logoPath }}"
>
```
```javascript
angular.module('myApp')
  .component('applicationLogo', {
    templateUrl: 'application-logo.component.html',
    controllerAs: 'applicationLogoController',
    controller: function(propertyStore) {
      const applicationLogoController = this;

      applicationLogoController.logoPath = false;

      propertyStore.init().then(() => {
        const logo = propertyStore.getValue("logoFileName");
        applicationLogoController.logoPath = `/logos/${logo}`;
      });
    }
  });
```

react2angular version:
```javascript
//@flow

import React, { Component } from 'react';
import react2angular from '../react2angular.react';
import {isEmpty} from 'lodash';

type Props = {
  propertyStore: {
    getValue: (str:string) => string,
    init: any
  }
}

type State = {
  logo: string
}

export default class ApplicationLogo extends Component<void, Props, State> {
  state = {
    logo : ''
  }

  componentDidMount() {
    this.props.propertyStore.init().then(() => {
     const logo = this.props.propertyStore.getValue("logoFileName");
     this.setState({logo});
    });
  }

  render() {
    const { logo } = this.state;

    return (
      <img src={`/logos/${logo}`} alt=""/>
    );
  }
}

angular.module('myApp')
.component('applicationLogo', react2angular(ApplicationLogo, {DI: ['propertyStore']}));
```

## Binding and transclusion example
Angular version
```html
<div class="empty-table-container">
  <my-icon name="{{ emptyTableController.iconClass }}"></my-icon>
  <span ng-transclude></span>
  <h6 ng-if="emptyTableController.searchable" class="js-searchable">Try different search</h6>
  <h6 ng-if="emptyTableController.subTitle" class="js-subtitle">Awesome subtitle</h6>
</div>
```
```javascript
angular.module('myApp')
  .component('emptyTable', {
    templateUrl: './empty-table.component.html',
    transclude: true,
    bindings: {
      icon: '@?',
      subTitle: '@?',
      searchable: '<?'
    },
    controllerAs: 'emptyTableController',
    controller: function () {
      const emptyTableController = this;

      emptyTableController.iconClass = null;

      emptyTableController.$onInit = function () {
        const icon = emptyTableController.icon ? emptyTableController.icon : 'files-o';
        emptyTableController.iconClass = icon;
      };
    }
  });
```

react2angular version
```javascript
//@flow

import React, { Component } from 'react';
import react2angular from './react2angular.react';
import MyIcon from './my-icon.component.react';

import type { Children } from 'react';

type Props = {
  icon?: string,
  subTitle?: bool,
  searchable?: bool,
  msg?: string,
  children?: Children,
};

export default class EmptyTable extends Component<void, Props, void> {
  render() {
    const iconClass = this.props.icon || 'files-o';
    return (
      <div className="empty-table-container m-t-20 m-b-20">
        <MyIcon name={iconClass}/>
        <span>{this.props.children}</span>
        {this.props.searchable ? <h6 className="js-searchable">Try different search</h6> : null}
        {this.props.subTitle ? <h6 className="js-subtitle">Awesome subtitle</h6> : null}
      </div>
    );
  }
}

angular.module('myApp')
.component('emptyTable', react2angular(EmptyTable, {
    bindings: {icon: '@?', subTitle: '@?', searchAble: '<?', msg: '@?'},
    hasChild: true
}));
```

## ngModel Example
Angular version:
```html
<div class="search-input">
  <input
    type="text"
    id="search-input"
    placeholder="search..."
    class="form-control form-input"
    ng-model="searchInputController.value"
    ng-model-options="{ debounce: 1000 }"
    ng-change="searchInputController.update()">
  <label for="search-input">
    <my-icon name="search"></my-icon>
  </label>
  <my-icon
    ng-if="searchInputController.value.length > 0"
    ng-click="searchInputController.clearInput()"
    name="times-circle"
  >
  </my-icon>
</div>
```
```javascript
angular.module('myApp')
  .component('searchInput', {
    templateUrl: './search-input.component.html',
    require: {
      ngModel: 'ngModel'
    },
    controllerAs: 'searchInputController',
    controller: function ($scope) {
      const searchInputController = this;

      searchInputController.$onInit = function () {
        $scope.$watch('searchInputController.ngModel.$viewValue', function () {
          searchInputController.value = searchInputController.ngModel.$viewValue;
        });
      };

      searchInputController.update = function () {
        searchInputController.ngModel.$setViewValue(searchInputController.value);
      };

      searchInputController.clearInput = function () {
        searchInputController.ngModel.$setViewValue("");
      };
    }
  });
```

react2angular version
```javascript
//@flow

import React, { Component } from 'react';
import react2angular from '../react2angular.react';
import MyIcon from '../my-icon/my-icon.component.react';
import DebounceInput from 'react-debounce-input';

type Props = {
  ngModel: {
    $viewValue: string,
    $setViewValue: (t: string) => void
  }
};

class searchInput extends Component<void, Props, void> {
  render() {
    const value = this.props.ngModel.$viewValue || '';
    return (
      <div className="search-input">
        <DebounceInput
          type="text"
          id="search-input"
          placeholder="search..."
          className="form-control form-input"
          value={value}
          debounceTimeout={1000}
          onChange={(event) => this.update(event.target.value)}
          autoFocus=""/>
        <label className="visible-xs-inline" htmlFor="search-input">
          <MyIcon name="search"/>
        </label>
        {this.renderClear()}
      </div>
    );
  }

  renderClear() {
    const value = this.props.ngModel.$viewValue || '';

    if (value.length <= 0) {
      return null;
    }

    return (<MyIcon onClick={() => this.clear()} name="times-circle"/>);
  }

  update(newValue: string) {
    this.props.ngModel.$setViewValue(newValue);
  }

  clear() {
    this.update('');
  }
}

export default searchInput;

angular.module('myApp').component('searchInput', react2angular(searchInput, {
  require: {
    ngModel: 'ngModel'
  }
}));
```