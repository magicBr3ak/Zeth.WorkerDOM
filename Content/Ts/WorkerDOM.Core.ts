namespace WorkerDOM {

    //#region Constants
    const SEPARATOR_PROP: string = '.';
    const SEPARATOR_PARAM: string = ':';
    const SEPARATOR_MANY: string = '|';
    const ATTR_PREFIX: string = 'w-';
    const BOOLEAN_DENY: string = '!';
    //#endregion

    //#region Methods_Helpers
    function elementActionIterator(value: IElementAction, key: string, element: HTMLElement, view: WView, tree: WViewActionTree) {
        value.action(element, view, tree, key);
    }
    function scopeActionIterator(value: IScopeAction, key: string, element: HTMLElement, view: WView, tree: WViewActionTree): IScopeActionResult {
        return value.action(element, view, tree, key);
    }
    function workerActionIterator(tree: WViewActionTree, key: string, view: WView, path: string, pathArray: Array<string>, value: any) {
        tree.execute(view, path, pathArray, functionToValue(value)[key]);
    }
    function functionToValue(value: any): any {
        while (isNotNull(value) && value instanceof Function) {
            value = value();
        }
        return value;
    }
    function newId(): string {
        return (Math.floor(Math.random() * 899999999) + 100000000).toString();
    }
    function writeWarning(key: string, params: Array<any>) {
        var value: string | Function = null;
        if ((value = DEBUG.get(key)) == null) return;

        if (value instanceof Function) value = value.apply(null, params);

        console.warn(value);
    }
    function writeError(key: string, params: Array<any>) {
        var value: string | Function = null;
        if ((value = DEBUG.get(key)) == null) return;

        if (value instanceof Function) value = value.apply(null, params);

        console.error(value);
    }
    function isNull(value: any) {
        return value == null;
    }
    function isNotNull(value: any) {
        return value != null;
    }
    function isTrue(value: any) {
        return value === true;
    }
    function isFalse(value: any) {
        return value === false;
    }
    function actionAttributeValue(element: HTMLElement, actionName: string): string {
        return element.getAttribute(ATTR_PREFIX + actionName);
    }
    function removeActionAttribute(element: HTMLElement, actionName: string) {
        element.removeAttribute(ATTR_PREFIX + actionName);
    }
    function forceEvent(element: any, eventName: string) {
        var event: any = null;

        if (typeof (Event) === 'function') event = new Event(eventName);
        else {
            event = document.createEvent('Event');
            event.initEvent(eventName, true, true);
        }

        if (element.dispatchEvent) element.dispatchEvent(event);
        else if (element.fireEvent) element.fireEvent(event);
    }
    function disposeInnerViews(element: HTMLElement) {
        var attribute: string = actionAttributeValue(element, 'id');
        var base: WBase = attribute ? OBJECTS.get(attribute) : null;
        var i: number = null;
        var c: number = element.children == null ? 0 : element.children.length;

        if (base && (<any>base.type).startsWith('View')) (<WView>base).dispose();
        else {
            for (i = 0; i < c; i++) disposeInnerViews(<HTMLElement>element.children[i]);
        }
    }
    //#endregion

    //#region Interfaces
    export interface IDictionary<T> {
        get(key: string): T;
        set(key: string, value: T);
        forEach(action: Function, params?: Array<any>, hasBreak?: boolean): any;
        clear();
    }

    export interface IReadOnlyDictionary<T> {
        get(key: string): T;
    }
    export interface IBase {
        readonly id: string;
        readonly type: string;

        getFullName(): string;
    }
    export interface IViewWorker {
        created: boolean;

        create();
        refresh(path: string);
        setEventListener(name: string, callback: Function, target?: IEventService);
    }

    export interface IViewConfiguration {
        readonly name: string;
        readonly params: any;

        controller($data: any, $worker: IViewWorker, $services?: IReadOnlyDictionary<any>, $params?: Array<any>);
    }
    export interface IServiceConfiguration {
        readonly name: string;

        service($view: WView): any;
    }
    export interface IScopeAction {
        readonly name: string;

        action(element: HTMLElement, view: WView, tree: WViewActionTree, name: string): IScopeActionResult;
    }
    export interface IElementAction {
        readonly name: string;

        action(element: HTMLElement, view: WView, tree: WViewActionTree, name: string);
    }
    export interface IViewTreeActionChild {
        readonly element: HTMLElement;
        readonly data: any;
        readonly prop: string;

        action(element: HTMLElement, data: any, view: WView);
    }
    export interface ISearchValueMetadata {
        scope: number;
    }
    export interface IDOMView {
        name: string;
        element: HTMLElement;
    }
    export interface IResult<T> {
        then(success: Function, error?: Function);
    }
    //#endregion

    //#region Classes
    class WResult<T> implements IResult<T> {
        private success: Function;
        private error: Function;

        private resolve(param: T) {
            if (this.success != null) this.success.call(null, param);
        }
        private reject(error: any) {
            if (this.error != null) this.error.call(null, error);
        }

        public then(success: Function, error?: Function) {
            this.success = success;
            this.error = error;
        }

        constructor(action: Function) {
            action.call(null, this.resolve, this.reject);
        }
    }
    class WDictionary<T> {
        private data: object;

        public get(key: string): T {
            return this.data[key];
        }
        public set(key: string, value: T) {
            this.data[key] = value;
        }
        public forEach(action: Function, params?: Array<any>, hasBreak?: boolean): any {
            var result: any = null;
            var key: string = null;

            if (hasBreak === true) {
                for (key in this.data)
                    if ((result = action.apply(null, params ? [this.data[key], key].concat(params) : [this.data[key], key])) != null)
                        return result;

                return null;
            }
            else {
                for (key in this.data)
                    action.apply(null, params ? [this.data[key], key].concat(params) : [this.data[key], key]);
            }
        }
        public clear() {
            this.data = {};
        }

        constructor(data?: object) {
            this.data = data ? data : {};
        }
    }
    class WBase implements IBase {
        public readonly id: string;
        public readonly type: string;

        public getFullName(): string {
            return this.type + '/' + this.id;
        }

        constructor(type: string) {
            this.id = newId();
            this.type = type;
        }
    }
    class WEvent extends WBase {
        private eventArray: WDictionary<WDictionary<Function>> = new WDictionary<WDictionary<Function>>();

        public setEventListener(source: WBase, eventName: string, callback?: Function) {
            var eventArray = this.eventArray.get(eventName);

            if (isNull(eventArray)) {
                this.eventArray.set(eventName, eventArray = new WDictionary<Function>());
            }

            if (isNotNull(eventArray.get(source.id)) && isNotNull(callback)) {
                writeWarning('M0001', [this, source, eventName]);
                return;
            }

            eventArray.set(source.id, callback);
        }
        public invoke(eventName: string, parameters?: Array<any>) {
            var eventArray = this.eventArray.get(eventName);

            if (isNotNull(eventArray)) {
                eventArray.forEach(function (value: Function) {
                    if (isNotNull(value)) {
                        value.apply(null, parameters);
                    }
                });
            }
        }

        constructor(type?: string) {
            super(type ? type : 'Event');
            var self: WEvent = this;

            OBJECTS.set(this.id, this);

            if (isNotNull(EVENTS)) {
                this.setEventListener(EVENTS, 'beforeRemove', function () { OBJECTS.set(self.id, null); });
            }
        }
    }
    class WViewConfig extends WBase {
        public readonly source: IViewConfiguration;
        public readonly prms: WDictionary<any>;

        private readonly services: Array<IServiceConfiguration> = [];

        private template: string | Function;

        public getTemplate(view: WView): string | WResult<string> {
            var getValue: Function = this.prms.get;

            if (isNull(this.template) && isNotNull(getValue('template'))) this.template = getValue('template');
            else if (isNotNull(getValue('templateUrl'))){
                this.template = function () {
                    var $http: IHttpService = view.services.get('http');

                    if (isNull($http)) throw new Error("The view does not have the http service included");

                    return $http.get(getValue('templateUrl'));
                }
            }

            return this.template instanceof Function ? <WResult<string>>this.template() : this.template;
        }
        public getServices(view: WView): WDictionary<any> {
            var i: number = null;
            var c: number = null;

            c = this.services.length;
            for (i = 0; i < c; i++) {
                view.services.set(this.services[i].name, this.services[i].service(view));
            }

            return view.services;
        }

        constructor(source: IViewConfiguration) {
            super('Config/' + source.name);
            var prms: WDictionary<any> = new WDictionary<any>(source.params);
            var i: number = null;
            var c: number = null;
            var serviceNames: Array<string> = prms.get('services');
            var service: IServiceConfiguration;

            if (serviceNames) {
                c = serviceNames.length;

                for (i = 0; i < c; i++) {
                    if ((service = SERVICES.get(serviceNames[i]))) this.services.push(service);
                    else writeError('M0002', [this, serviceNames[i]]);
                }
            }

            if (isNull(this.template = prms.get('template')) && isNull(prms.get('templateUrl'))) {
                EVENTS.setEventListener(this, 'templatesLoaded', function (elements: WDictionary<HTMLElement>) {
                    if (elements.get(source.name)) prms.set('template', elements.get(source.name).innerHTML);
                });
            }

            this.prms = prms;
            this.source = source;
        }
    }
    class WViewActionTree {
        private trees: WDictionary<WViewActionTree> = new WDictionary<WViewActionTree>();
        private childs: Array<IViewTreeActionChild> = [];

        public add(pathArray: Array<string>, child: IViewTreeActionChild) {
            var path: string = null;
            var tree: WViewActionTree = null;

            if (pathArray.length == 0) this.childs.push(child);
            else {
                path = pathArray.shift();

                if (isNull(tree = this.trees.get(path))) this.trees.set(path, (tree = new WViewActionTree()));

                tree.add(pathArray, child);
            }
        }
        public execute(view: WView, path: string, pathArray: Array<string>, value: any) {
            var prop: string = null;
            var i: number = null;
            var c: number = null;
            var child: IViewTreeActionChild;

            if (pathArray.length == 0) {
                c = this.childs.length;

                for (i = 0; i < c; i++) {
                    child = this.childs[i];

                    child.data[child.prop] = value;
                    child.action(child.element, child.data, view);
                }
                this.trees.forEach(workerActionIterator, [view, path, pathArray, value]);
            }
            else if (isNotNull(value)) {
                prop = pathArray.shift();

                value = functionToValue(value);
                value = value[prop];

                if (this.trees.get(prop)) this.trees.get(prop).execute(view, path, pathArray, value);
            }
        }
        public dispose() {
            this.trees.forEach(function (tree: WViewActionTree) { tree.dispose(); })
            this.trees.clear();

            this.childs = [];
        }
    }
    class WViewWorker implements IViewWorker {
        public trees: Array<WViewActionTree> = [];
        public created: boolean = false;

        private view: WView;
        private template: string;
        private isWaiting: boolean = false;

        private createWithTemplate() {
            var tree: WViewActionTree = this.trees[0];

            tree.dispose();

            this.view.element.innerHTML = this.template;
            this.view.createElement(this.view.element, tree);
            this.view.invoke('afterCreate');

            this.created = true;
        }
        private createWithGet(template: string) {
            this.isWaiting = false;
            this.template = template;
            this.createWithTemplate();
        }

        public create() {
            var configTemplate: string | WResult<string> = null;
            if (this.isWaiting) return;

            this.created = false;

            this.view.invoke('beforeCreate');

            if (isNull(this.template)) {
                configTemplate = this.view.config.getTemplate();

                if (typeof (configTemplate) == 'string') {
                    this.template = configTemplate;
                    this.createWithTemplate();
                }
                else {
                    this.isWaiting = true;
                    (<WResult<string>>configTemplate).then(this.createWithGet);
                }
            }
            else {
                this.createWithTemplate();
            }
        }
        public refresh(path: string) {
            var i: number = null;
            var c: number = this.trees.length;

            for (i = 0; i < c; i++) this.trees[i].execute(this.view, path, path.split(SEPARATOR_PROP), this.view.data);
        }
        public setEventListener(name: string, callback: Function, target?: WEvent) {
            if (isNull(target)) this.view.setEventListener(this.view, name, callback);
            else target.setEventListener(this.view, name, callback);
        }
        public dispose() {
            var i: number = null;
            var c: number = this.trees.length;

            for (i = 0; i < c; i++) this.trees[0].dispose();
        }

        constructor(view: WView, tree: WViewActionTree) {
            this.view = view;
            this.trees.push(tree);
        }
    }
    class WView extends WEvent {
        public readonly data: any = {};
        public readonly config: WViewConfig;
        public readonly element: HTMLElement;
        public readonly extra: WDictionary<any>;
        public readonly worker: WViewWorker;
        public readonly scope: Array<object> = [this.data];
        public readonly services: WDictionary<any> = new WDictionary<any>();

        public getValue(path: string, meta?: ISearchValueMetadata): any | Function {
            var valueNames: Array<string> = path.split(SEPARATOR_PROP);
            var i: number = null;
            var c: number = valueNames.length;
            var j: number = null;
            var b: number = this.scope.length;
            var value: object = null;

            for (j = 0; j < b; j++) {
                value = this.scope[j];
                for (i = 0; i < c; i++) {
                    value = functionToValue(value);
                    value = value[valueNames[i]];

                    if (isNull(value)) break;
                }
                if (isNotNull(value)) break;
            }

            if (isNotNull(meta)) meta.scope = b - j;

            return value;
        }
        public createElement(element: HTMLElement, tree: WViewActionTree) {
            var i: number = null;
            var c: number = null;
            var childrens: Array<HTMLElement> = null;
            var scopeResult: IScopeActionResult = null;
            var scopeTree: WViewActionTree = null;

            tree = tree ? tree : this.worker.trees[0];

            if ((scopeResult = SCOPE_ACTIONS.forEach(scopeActionIterator, [element, this, tree], true))) {
                scopeTree = new WViewActionTree();
                scopeResult.action(element, scopeResult.data, this, scopeTree);
                this.worker.trees.push(scopeTree);
                return;
            }

            if (element.children) {
                c = element.children.length;
                childrens = [];

                for (i = 0; i < c; i++) childrens.push(<HTMLElement>element.children[i]);
                for (i = 0; i < c; i++) this.createElement(childrens[i], tree);
            }


            ELEMENT_ACTIONS.forEach(elementActionIterator, [element, this, tree]);
        }
        public dispose() {
            this.invoke('beforeRemove');

            this.worker.dispose();

            this.invoke('afterRemove');
        }

        constructor(config: WViewConfig, element: HTMLElement, tree: WViewActionTree, extra?: WDictionary<any>) {
            super('View/' + config.source.name);
            this.config = config;
            this.element = element;
            this.extra = extra == null ? new WDictionary<any>() : extra;
            this.worker = new WViewWorker(this, tree);
        }
    }
    //#endregion

    //#region Services

    //#region Event
    export interface IEventService {
        readonly id: string;

        invoke(eventName: string, parameters?: Array<any>);
    }

    function serviceEvent(view: WView): IEventService {
        var event: WEvent = null;

        event = view.extra.get('type') == 'parent' ? <WEvent>OBJECTS.get(view.extra.get('id')) : new WEvent();

        return event;
    }
    //#endregion

    //#region Http  
    export interface IHttpResponseMetadata {
        status: number;
        startTime: Date;
        endTime: Date;
        responseType: string;
    }
    export interface IHttpService {
        hasError(data: any): boolean;
        getError(data: any): string;
        send(method: string, url: string, data?: any, headers?: IDictionary<string>): IResult<any>;
        get(url: string, data?: any, headers?: IDictionary<string>): IResult<any>;
        post(url: string, data?: any, headers?: IDictionary<string>): IResult<any>;
    }
    export interface IHttpErrorResponse {
        ErrorId: string;
        ErrorMessage: string;
    }
    
    class HttpService implements IHttpService {
        private view: WView;

        private parseResponse(xhr: XMLHttpRequest, meta: IHttpResponseMetadata): any {
            var contentType: string = xhr.getResponseHeader('Content-Type')
            if (contentType.indexOf('application/json') >= 0) {
                return [JSON.parse(xhr.response), meta]
            }
            else if (contentType == 'text/csv') {
                var container: any = {};
                var $csv: ICsvService = this.view.services.get('csv');

                if (isNull($csv)) throw new Error("The view does not have the csv service included");

                $csv.split(xhr.responseText, container);

                return [container, meta];
            }
            else return [xhr.response, meta];
        }

        public hasError(data: IHttpErrorResponse): boolean {
            return data != null && (isNotNull(data.ErrorId) || isNotNull(data.ErrorMessage));
        }
        public getError(data: IHttpErrorResponse): string {
            var msg = 'Error';

            if (data.ErrorId) msg += '(' + data.ErrorId + ')';

            if (data.ErrorMessage) msg += ': ' + data.ErrorMessage;
            else msg += ', Contactarse con el administrador';

            return msg;
        }
        public send(method: string, url: string, data?: any, headers?: WDictionary<string>): WResult<any> {
            var service: HttpService = this;
            var result: WResult<string> = new WResult<string>(function (resolve: Function, reject: Function) {
                var xhr: XMLHttpRequest = new XMLHttpRequest();
                var meta: IHttpResponseMetadata = <IHttpResponseMetadata>{};

                xhr.open(method, url, true);

                if (headers) headers.forEach(function (value, key) { xhr.setRequestHeader(key, value); });

                xhr.onreadystatechange = function (e) {
                    if (xhr.readyState == 4) {
                        meta.status = xhr.status;
                        meta.responseType = xhr.getResponseHeader('Content-Type');
                        meta.endTime = new Date();

                        if (xhr.status == 200) {
                            resolve.apply(result, service.parseResponse(xhr, meta));
                        }
                        else {
                            reject.call(result, new Error('HTTP Request Error: ' + xhr.response), meta);
                        }
                    }
                }

                xhr.onerror = function (e) {
                    meta.endTime = new Date();

                    reject.call(result, new Error('HTTP Request Error: can not connect to the URL.'), meta);
                }

                meta.startTime = new Date();

                xhr.send(data);
            });

            return result;
        }
        public get(url: string, data?: any, headers?: any): WResult<any> {
            return this.send('GET', url, data, headers);
        }
        public post(url: string, data?: any, headers?: any): WResult<any> {
            return this.send('POST', url, data, headers);
        }

        constructor(view: WView) {
            this.view = view;
        }
    }
    function serviceHttp(view: WView): IHttpService {
        return new HttpService(view);
    }
    //#endregion

    //#endregion

    //#region Methods_Main
    function windowLoad() {
        var VIEWS: WDictionary<HTMLElement> = new WDictionary<HTMLElement>();

        templateFinder(document.body, VIEWS);
        EVENTS.invoke('templatesLoaded', [VIEWS]);

        if (FIRST_VIEW.name != null) executeView(CONFIGS.get(FIRST_VIEW.name), FIRST_VIEW.element, new WViewActionTree());
    }
    function templateFinder(element: HTMLElement, container: WDictionary<HTMLElement>) {
        var viewAttribute: string = actionAttributeValue(element, 'view');
        var child: HTMLElement = null;
        var templateArray: Array<HTMLElement> = [];
        var hasView: boolean = isNotNull(viewAttribute) && isNotNull(CONFIGS.get(viewAttribute));
        var i: number = null;
        var c: number = null;

        if (hasView && isNull(FIRST_VIEW.name)) {
            FIRST_VIEW.name = viewAttribute;
            FIRST_VIEW.element = element;
        }

        c = element.children == null ? 0 : element.children.length;
        for (i = 0; i < c; i++) {
            child = <HTMLElement>element.children[i];
            templateFinder(child, container);
            if (actionAttributeValue(child, 'template') != null) templateArray.push(child);
        }

        c = templateArray.length;
        for (i = 0; i < c; i++) element.removeChild(templateArray[i]);

        if (hasView) {
            container.set(viewAttribute, element);
        }
    }
    function executeView(config: WViewConfig, element: HTMLElement, tree: WViewActionTree, parameters?: Array<any>, extra?: WDictionary<any>): WView {
        var view: WView = null;

        removeActionAttribute(element, 'view');

        view = new WView(config, element, tree, extra);

        element.setAttribute(ATTR_PREFIX + 'id', view.id);

        config.source.controller(view.data, view.worker, config.getServices(view), parameters);

        if (!isFalse(config.prms.get('autoCreate'))) view.worker.create();

        return view;
    }

    function addScopeAction(value: IScopeAction) {
        if (SCOPE_ACTIONS.get(value.name) || ELEMENT_ACTIONS.get(value.name)) {
            writeError('M0003', [value.name]);
        }
        else {
            SCOPE_ACTIONS.set(value.name, value);
        }
    }
    function addElementAction(value: IElementAction) {
        if (ELEMENT_ACTIONS.get(value.name) || SCOPE_ACTIONS.get(value.name)) {
            writeError('M0003', [value.name]);
        }
        else {
            ELEMENT_ACTIONS.set(value.name, value);
        }
    }
    function addService(value: IServiceConfiguration) {
        if (SERVICES.get(value.name)) {
            writeError('M0004', [value.name]);
        }
        else {
            SERVICES.set(value.name, value);
        }
    }

    export function addController(value: IViewConfiguration) {
        if (CONFIGS.get(value.name)) {
            writeError('M0009', [value.name]);
        }
        else {
            CONFIGS.set(value.name, new WViewConfig(value));
        }
    }
    //#endregion

    //#region Methods_Scope

    //#region View
    interface IScopeViewData {
        readonly config: WViewConfig;
        readonly params: Array<any>;
    }
    interface IScopeActionResult {
        readonly data: any;

        action(element: HTMLElement, data: any, view: WView, tree: WViewActionTree);
    }
    interface IScopeActionGeneric<T> {
        readonly data: T;

        action(element: HTMLElement, data: T, view: WView, tree: WViewActionTree);
    }

    function scopeExecuteView(element: HTMLElement, data: IScopeViewData, view: WView, tree: WViewActionTree) {
        executeView(data.config, element, tree, data.params);
    }
    function scopeActionView(element: HTMLElement, view: WView, tree: WViewActionTree, name: string): IScopeActionGeneric<IScopeViewData> {
        var attribute: string = actionAttributeValue(element, name);
        var config: WViewConfig = null;
        var params: Array<string | any> = [];
        var i: number = null;
        var c: number = null;

        if (attribute == null || (config = CONFIGS.get(attribute)) == null) return null;

        attribute = actionAttributeValue(element, 'params');

        if (attribute) {
            params = attribute.split(SEPARATOR_MANY);
            c = params.length;

            for (i = 0; i < c; i++)
                if ((params[i] = view.getValue(params[i])) == null)
                    break;

            if (i != c) return null;
        }

        removeActionAttribute(element, name);

        return { data: { config: config, params: params }, action: scopeExecuteView };
    }
    //#endregion

    //#region For
    interface IScopeForData {
        value: any;
        iteratorName: string;
        parentNode: HTMLElement;
        iteratorHTML: string;
        beforeNode: HTMLElement;
        afterNode: HTMLElement;
        tree: WViewActionTree;
        elementArray: Array<HTMLElement>;
        name: string;
        attr: string;
    }
    function scopeInsertAction(data: IScopeForData): Function {
        var referenceNode: HTMLElement = null;

        if (data.beforeNode) {
            referenceNode = data.beforeNode;

            return function (node: HTMLElement) {
                referenceNode.insertAdjacentElement('afterend', node);
                referenceNode = node;
            };
        }
        else if (data.afterNode) {
            referenceNode = data.afterNode;

            return function (node: HTMLElement) {
                referenceNode.insertAdjacentElement('beforebegin', node);
            };
        }
        else {
            return function (node: HTMLElement) {
                data.parentNode.appendChild(node);
            }
        }
    }
    function scopeExecuteFor(element: HTMLElement, data: IScopeForData, view: WView, tree?: WViewActionTree) {
        var iterator: any = {};
        var itemArray: Array<any> = functionToValue(data.value);
        var iteratorName: string = data.iteratorName;
        var elementArray: Array<HTMLElement> = data.elementArray;
        var parentNode: HTMLElement = data.parentNode;
        var baseElement: HTMLElement = null;
        var iteratorElement: HTMLElement = null;
        var insertAction: Function = scopeInsertAction(data);
        var i: number = null;
        var c: number = null;

        try {

            if (isNull(itemArray)) return;

            if (tree) data.tree = tree;
            else tree = data.tree;

            tree.dispose();

            if (isNotNull(elementArray) && elementArray.length > 0) {
                c = elementArray.length;
                for (i = 0; i < c; i++) {
                    disposeInnerViews(elementArray[i]);
                    parentNode.removeChild(elementArray[i]);
                }
            }

            view.scope.unshift(iterator);

            baseElement = document.createElement(parentNode.tagName);
            baseElement.innerHTML = data.iteratorHTML;
            baseElement = <HTMLElement>baseElement.firstChild;

            elementArray = [];
            c = itemArray.length;
            for (i = 0; i < c; i++) {
                iterator[iteratorName] = itemArray[i];
                iteratorElement = <HTMLElement>baseElement.cloneNode(true);
                view.createElement(iteratorElement, tree);
                insertAction(iteratorElement);
                elementArray.push(iteratorElement);
            }

            data.elementArray = elementArray;
            view.scope.shift();
        }
        catch (error) {
            writeError('M0007', [view, data.name, data.attr, error]);
        }
    }
    function scopeActionFor(element: HTMLElement, view: WView, tree: WViewActionTree, name: string): IScopeActionGeneric<IScopeForData> {
        var attribute: string = actionAttributeValue(element, name);
        var params: Array<string> = null;
        var data: IScopeForData = <IScopeForData>{};
        var value: any;
        var valueMeta: ISearchValueMetadata = <ISearchValueMetadata>{};

        if (isNull(attribute)) return null;
        if ((params = attribute.split(SEPARATOR_PARAM)).length != 2) {
            writeError('M0005', [view, name, attribute]);
            return null;
        }

        if (isNull(value = view.getValue(params[0], valueMeta))) {
            writeWarning('M0010', [view, name, attribute]);
            return;
        }

        removeActionAttribute(element, name);

        data.name = name;
        data.attr = attribute;
        data.value = value;
        data.iteratorName = params[1];
        data.parentNode = <HTMLElement>element.parentNode;
        data.iteratorHTML = element.outerHTML;
        data.beforeNode = <HTMLElement>element.previousElementSibling;
        data.afterNode = <HTMLElement>element.nextElementSibling;

        element.parentNode.removeChild(element);

        if (valueMeta.scope == 1) tree.add(params[0].split(SEPARATOR_PROP), { action: scopeExecuteFor, data: data, element: element, prop: 'value' });

        return { data: data, action: scopeExecuteFor };
    }
    //#endregion

    //#endregion

    //#region Methods_Element

    //#region Attr
    const ATTR_BASE_REPLACE_REGEX = new RegExp('%', 'g');

    function elementActionAttr(element: HTMLElement, view: WView, tree: WViewActionTree, name: string) {
        var attribute: string = actionAttributeValue(element, name);
        var value: any = null;
        var params: Array<string> = null;
        var key: string = null;

        try {
            if (isNull(attribute)) return;

            params = attribute.split(SEPARATOR_PARAM);

            if (isNull(value = functionToValue(view.getValue(params[0])))) return;
            removeActionAttribute(element, name);

            if (params.length == 1) for (key in value) element.setAttribute(key, value);
            else {
                value = '' + value;
                element.setAttribute(params[1], params.length < 3 ? value : params[2].replace(ATTR_BASE_REPLACE_REGEX, value));
            }
        }
        catch (error) {
            writeError('M0007', [view, name, attribute, error]);
        }
    }
    //#endregion

    //#region Bind
    interface IElementBindData {
        value: any;
        setter: string | Function;
        parser(value: any): any;
        name: string;
        attr: string;
    }
    function htmlSetter(element: HTMLElement): string | Function {
        switch (element.tagName) {
            case 'TEXTAREA':
            case 'INPUT':
                return 'value';
            case 'SELECT':
                return element.getAttribute('multiple') ? htmlModelSelectMultipleSetter : 'value';
            default:
                return 'innerText';
        }
    }
    function htmlModelSelectMultipleSetter(element: HTMLElement, value: Array<string>) {
        var i: number = null;
        var c: number = element.children.length;
        var j: number = null;
        var children: HTMLOptionElement = null;
        var selection: Array<string> = value.slice(0);

        for (i = 0; i < c; i++) {
            children = <HTMLOptionElement>element.children[i];

            for (j = 0; j < selection.length; j++) {
                if (children.value == selection[j]) {
                    selection.splice(j, 1);
                    children.selected = true;
                    break;
                }
            }

            if (selection.length == 0) break;
        }
    }
    function elementExecuteBind(element: HTMLElement, data: IElementBindData, view: WView) {
        var value = functionToValue(data.value);
        try {
            value = data.parser ? data.parser(value) : value;

            if (data.setter instanceof Function) data.setter(element, value);
            else element[data.setter] = value;
        }
        catch (error) {
            writeError('M0007', [view, data.name, data.attr, error]);
        }
    }
    function elementActionBind(element: HTMLElement, view: WView, tree: WViewActionTree, name: string) {
        var attribute: string = actionAttributeValue(element, name);
        var params: Array<string> = null;
        var value: any;
        var parser: any;
        var valueMeta: ISearchValueMetadata = <ISearchValueMetadata>{};
        var parserMeta: ISearchValueMetadata = <ISearchValueMetadata>{};
        var data: IElementBindData = <IElementBindData>{};

        if (isNull(attribute)) return;

        params = attribute.split(SEPARATOR_PARAM);

        if (isNull(value = view.getValue(params[0], valueMeta)) || (params.length > 1 && isNull(parser = view.getValue(params[1], parserMeta)))) {
            writeWarning('M0010', [view, name, attribute]);
            return;
        }

        data.name = name;
        data.attr = attribute;
        data.setter = htmlSetter(element);
        data.value = value;
        data.parser = parser;

        removeActionAttribute(element, name);

        elementExecuteBind(element, data, view);

        if (valueMeta.scope == 1) tree.add(params[0].split(SEPARATOR_PROP), { action: elementExecuteBind, data: data, element: element, prop: 'value' });
        if (parserMeta.scope == 1) tree.add(params[1].split(SEPARATOR_PROP), { action: elementExecuteBind, data: data, element: element, prop: 'parser' });
    }
    //#endregion

    //#region If
    interface IElementIfData {
        value: any;
        name: string;
        attr: string;
        deny: boolean;
        default: any;
    }
    function elementExecuteIf(element: HTMLElement, data: IElementIfData, view: WView) {
        var value: boolean = isFalse(functionToValue(data.value));

        try {
            if (data.deny) value = !value;

            element.style.display = value ? 'none' : data.default;
        }
        catch (error) {
            writeError('M0007', [view, data.name, data.attr, error]);
        }
    }
    function elementActionIf(element: HTMLElement, view: WView, tree: WViewActionTree, name: string) {
        var attribute: string = actionAttributeValue(element, name);
        var data: IElementIfData = <IElementIfData>{};
        var value: any = null;
        var valueMeta: ISearchValueMetadata = <ISearchValueMetadata>{};

        if (isNull(attribute)) return;

        if (attribute[0] == BOOLEAN_DENY) {
            data.deny = true;
            attribute = attribute.substr(1);
        }
        else data.deny = false;

        if (isNull(value = view.getValue(attribute, valueMeta))) {
            writeWarning('M0010', [view, name, attribute]);
            return;
        }

        removeActionAttribute(element, name);

        data.name = name;
        data.attr = attribute;
        data.value = value;
        data.default = element.style.display;

        elementExecuteIf(element, data, view);

        if (valueMeta.scope == 1) tree.add(attribute.split(SEPARATOR_PROP), { action: elementExecuteIf, data: data, element: element, prop: 'value' });
    }
    //#endregion

    //#region Enabled
    interface IElementEnabledData {
        value: any;
        name: string;
        attr: string;
        deny: boolean;
    }
    function elementExecuteEnabled(element: HTMLInputElement, data: IElementEnabledData, view: WView) {
        var value: boolean = isFalse(functionToValue(data.value));

        try {
            if (data.deny) value = !value;

            element.disabled = value ? true : false;
        }
        catch (error) {
            writeWarning('M0007', [view, data.name, data.attr, error]);
        }
    }
    function elementActionEnabled(element: HTMLInputElement, view: WView, tree: WViewActionTree, name: string) {
        var attribute: string = actionAttributeValue(element, name);
        var data: IElementEnabledData = <IElementEnabledData>{};
        var value: any = null;
        var valueMeta: ISearchValueMetadata = <ISearchValueMetadata>{};

        if (isNull(attribute)) return;

        if (attribute[0] == BOOLEAN_DENY) {
            data.deny = true;
            attribute = attribute.substr(1);
        }
        else data.deny = false;

        if (isNull(value = view.getValue(attribute, valueMeta))) {
            writeWarning('M0010', [view, name, attribute]);
            return;
        }

        data.name = name;
        data.attr = attribute;
        data.value = value;

        elementExecuteEnabled(element, data, view);

        if (valueMeta.scope == 1) tree.add(attribute.split(SEPARATOR_PROP), { action: elementExecuteEnabled, data: data, element: element, prop: 'value' });
    }
    //#endregion

    //#region Style
    interface IElementStyleData {
        value: any;
        prop: string;
        name: string;
        attr: string;
    }
    function elementExecuteStyle(element: HTMLElement, data: IElementStyleData, view: WView) {
        var value: any = functionToValue(data.value);
        var key: string;

        try {
            if (isNull(data.prop)) {
                for (key in value) {
                    element.style[key] = value[key];
                }
            }
            else {
                element.style[data.prop] = value;
            }
        }
        catch (error) {
            writeError('M0007', [view, data.name, data.attr, error]);
        }
    }
    function elementActionStyle(element: HTMLElement, view: WView, tree: WViewActionTree, name: string) {
        var attribute: string = actionAttributeValue(element, name);
        var data: IElementStyleData = <IElementStyleData>{};
        var params: Array<string> = null;
        var value: any;
        var valueMeta: ISearchValueMetadata = <ISearchValueMetadata>{};

        if (isNull(attribute)) return;

        params = attribute.split(SEPARATOR_PARAM);

        if (isNull(value = view.getValue(params[0], valueMeta))) {
            writeError('M0010', [view, name, attribute]);
            return;
        }

        removeActionAttribute(element, name);

        data.name = name;
        data.attr = attribute;
        data.value = value;

        if (params.length > 1) data.prop = params[1];

        elementExecuteStyle(element, data, view);

        if (valueMeta.scope == 1) tree.add(params[0].split(SEPARATOR_PROP), { action: elementExecuteStyle, data: data, element: element, prop: 'value' });
    }
    //#endregion

    //#region Class
    interface IElementClassData {
        value: any;
        class: string;
        name: string;
        attr: string;
        param: any;
    }
    function elementExecuteClass(element: HTMLElement, data: IElementClassData, view: WView) {
        var value: any = data.value;
        var param: any = data.param;

        try {
            element.className = data.class + (isNull(param) ? functionToValue(value) : value(functionToValue(param)));
        }
        catch (error) {
            writeError('M0007', [view, data.name, data.attr, error]);
        }
    }
    function elementActionClass(element: HTMLElement, view: WView, tree: WViewActionTree, name: string) {
        var attribute: string = actionAttributeValue(element, name);
        var data: IElementClassData = <IElementClassData>{};
        var params: Array<string> = null;
        var value: any;
        var param: any;
        var valueMeta: ISearchValueMetadata = <ISearchValueMetadata>{};
        var paramMeta: ISearchValueMetadata = <ISearchValueMetadata>{};

        if (isNull(attribute)) return;

        params = attribute.split(SEPARATOR_PARAM);

        if (isNull(value = view.getValue(params[0], valueMeta))) {
            writeWarning('M0010', [view, name, attribute]);
            return;
        }
        if (params.length > 1 && isNull(param = view.getValue(params[1], paramMeta))) {
            writeWarning('M0010', [view, name, attribute]);
            return;
        }

        removeActionAttribute(element, name);

        data.name = name;
        data.attr = attribute;
        data.value = value;
        data.class = element.className ? element.className + ' ' : '';
        data.param = param;

        elementExecuteClass(element, data, view);

        if (valueMeta.scope == 1) tree.add(params[0].split(SEPARATOR_PROP), { action: elementExecuteClass, data: data, element: element, prop: 'value' });
        if (paramMeta.scope == 1) tree.add(params[1].split(SEPARATOR_PROP), { action: elementExecuteClass, data: data, element: element, prop: 'param' });
    }
    //#endregion

    //#region Model
    interface IElementModelData {
        value: any;
        setter: string | Function;
        isFromThis: boolean;
        parser(value: any): any;
        name: string;
        attr: string;
    }
    function htmlGetter(element: HTMLElement): string | Function {
        switch (element.tagName) {
            case 'TEXTAREA':
            case 'INPUT':
                return 'value';
            case 'SELECT':
                return element.getAttribute('multiple') ? htmlModelSelectMultipleGetter : 'value';
            default:
                return null;
        }
    }
    function htmlModelSelectMultipleGetter(element: HTMLElement): Array<string> {
        var selection: Array<string> = [];
        var i: number = null;
        var c: number = element.children.length;

        for (i = 0; i < c; i++)
            if ((<any>element.children[i]).selected)
                selection.push((<any>element.children[i]).value);

        return selection;
    }
    function htmlModelEvent(element: HTMLElement): string {
        switch (element.tagName) {
            case 'TEXTAREA':
                return 'input';
            case 'INPUT':
                switch ((<HTMLInputElement>element).type) {
                    case 'text':
                        return 'input';
                    default:
                        return 'change';
                }
            case 'SELECT':
                return 'change';
            default:
                return null;
        }
    }
    function elementExecuteModel(element: HTMLElement, data: IElementModelData, view: WView) {
        var value: any = null;

        try {
            if (data.isFromThis) { data.isFromThis = false; return; }

            value = functionToValue(data.value);
            value = data.parser ? data.parser(value) : value;
            
            if (data.setter instanceof Function) data.setter(element, value);
            else element[data.setter] = value;
        }
        catch (error) {
            writeWarning('M0007', [view, data.name, data.attr, error]);
        }
    }
    function elementActionModel(element: HTMLElement, view: WView, tree: WViewActionTree, name: string) {
        var attribute: string = actionAttributeValue(element, name);
        var params: Array<string> = null;
        var data: IElementModelData = <IElementModelData>{};
        var props: Array<string> = null;
        var prop: string = null;
        var container: any = null;
        var getter: string | Function = null;
        var event: string = null;
        var value: any;
        var parser: any;
        var valueMeta: ISearchValueMetadata = <ISearchValueMetadata>{};
        var parserMeta: ISearchValueMetadata = <ISearchValueMetadata>{};

        if (isNull(attribute)) return;

        params = attribute.split(SEPARATOR_PARAM);

        data.setter = htmlSetter(element);
        if (isNull(getter = htmlGetter(element)) || isNull(event = htmlModelEvent(element))) {
            writeError('M0008', [view, name, attribute, element]);
            return;
        }

        props = params[0].split(SEPARATOR_PROP);
        if (props.length < 2) {
            writeError('M0006', [view, name, attribute]);
            return;
        }

        if (isNull(value = view.getValue(params[0], valueMeta)) || (params.length > 1 && isNull(parser = view.getValue(params[1], parserMeta)))) {
            writeWarning('M0010', [view, name, attribute]);
            return;
        }

        removeActionAttribute(element, name);

        data.value = value;
        data.parser = parser;

        prop = props.pop();
        container = view.getValue(props.join(SEPARATOR_PROP));

        attribute = params[0];
        element.addEventListener(event, function () {
            var objectValue = data.value;
            var elementValue = getter instanceof Function ? getter(element) : element[getter];

            container[prop] = data.parser ? data.parser(elementValue) : elementValue;

            if (objectValue != elementValue) { data.isFromThis = true; view.worker.refresh(attribute); }
        });

        elementExecuteModel(element, data, view);

        if (valueMeta.scope == 1) tree.add(props, { action: elementExecuteModel, data: data, element: element, prop: 'container' });
        if (valueMeta.scope == 1) tree.add(params[0].split(SEPARATOR_PROP), { action: elementExecuteModel, data: data, element: element, prop: 'value' });
        if (parserMeta.scope == 1) tree.add(params[1].split(SEPARATOR_PROP), { action: elementExecuteModel, data: data, element: element, prop: 'parser' });
    }
    //#endregion

    //#region On
    function elementActionOnHook(element: HTMLElement, view: WView, params: Array<string>, eventName: string, eventsFound: Array<string>, name: string, attr: string) {
        var callback: Function = null;
        var param: any = null;
        var callbackParams: Array<any> = [element];

        if (isNull(callback = view.getValue(params[0])) || !(callback instanceof Function)) {
            writeWarning('M0006', [view, name, attr]);
            return;
        }

        if (params.length > 1) {
            if (isNull(param = view.getValue(params[1]))) return;
            callbackParams.unshift(param);
        }

        eventsFound.push(eventName);
        element.addEventListener(eventName, function (e) { callback.apply(element, callbackParams.concat(e)); })
    }
    function elementActionOn(element: HTMLElement, view: WView, tree: WViewActionTree, name: string) {
        var attributes: NamedNodeMap = element.attributes;
        var attribute: Attr | string = null;
        var i: number = null;
        var c: number = attributes.length;
        var j: number = ATTR_PREFIX.length;
        var eventsFound: Array<string> = [];
        var params: Array<string> = null;
        var eventName: string = null;

        for (i = 0; i < c; i++) {
            attribute = attributes[i];
            params = attribute.nodeValue.split(SEPARATOR_PARAM);
            eventName = attribute.nodeName.substr(j + 3);
            attribute = attribute.nodeName;

            if ((<any>attribute).startsWith(ATTR_PREFIX + name + '-'))
                elementActionOnHook(element, view, params, eventName, eventsFound, name, attribute);
        }

        c = eventsFound.length;
        for (i = 0; i < c; i++) removeActionAttribute(element, name + '-' + eventsFound[i]);
    }
    //#endregion

    //#region Create
    function elementActionCreate(element: HTMLElement, view: WView, tree: WViewActionTree, name: string) {
        var attribute: string = actionAttributeValue(element, name);
        var value: Function = null;

        try {
            if (isNull(attribute)) return;

            if (isNull(value = view.getValue(attribute))) {
                writeWarning('M0010', [view, name, attribute]);
                return;
            }

            removeActionAttribute(element, name);

            value.call(null, element);
        }
        catch (error) {
            writeError('M0007', [view, name, attribute, error]);
        }
    }
    //#endregion

    //#endregion

    //#region Autocomplete
    const AUTOCOMPLETE_MAX_ITEMS: number = 5;

    interface IElementAutocomplete {
        control: HTMLElement;
        value: Array<any>;
        prop: string;
        input: HTMLInputElement;
        index: number;
    }
    function removeAutocomplete(data: IElementAutocomplete) {
        if (isNotNull(data.control)) {
            data.control.parentNode.removeChild(data.control);
            data.control = null;
        }
    }
    function addAutocompleteElement(control: HTMLElement, input: HTMLInputElement, value: any) {
        if (value.toLowerCase().indexOf(input.value.toLowerCase()) < 0) return;

        var innerControl: HTMLElement = document.createElement('div');
        var innerInput: HTMLInputElement = document.createElement('input');
        var foundText: HTMLSpanElement = document.createElement('span');
        var otherText: HTMLSpanElement = document.createElement('span');

        innerInput.value = value;
        foundText.innerText = value.substr(0, input.value.length);
        otherText.innerText = value.substr(input.value.length);

        innerInput.type = 'hidden';
        foundText.className = 'bold';

        innerControl.appendChild(foundText);
        innerControl.appendChild(otherText);
        innerControl.appendChild(innerInput);

        innerControl.addEventListener('click', function () {
            input.value = value;
            input.focus();
            forceEvent(input, 'input');
        })

        control.appendChild(innerControl);
    }
    function addAutocomplete(element: HTMLElement, data: IElementAutocomplete) {
        var itemArray: Array<any> = data.value;
        var itemProp: string = data.prop;
        var input: HTMLInputElement = data.input;
        var control: HTMLElement = null;
        var i: number = 0;

        removeAutocomplete(data);
        if (itemArray.length == 0) return;

        control = document.createElement('div');
        control.className = 'auto-complete';

        while (i < itemArray.length && control.children.length < AUTOCOMPLETE_MAX_ITEMS) {
            addAutocompleteElement(control, input, itemProp ? itemArray[i][itemProp] : itemArray[i]);
            i++;
        }

        data.index = 0;
        if (control.children.length > 0) control.children[0].className = 'selected';

        data.control = control;
        element.appendChild(control);
    }
    function navigateAutocomplete(element: HTMLElement, data: IElementAutocomplete, event: KeyboardEvent) {
        var control: HTMLElement = data.control;
        var index: number = data.index;
        var input: HTMLInputElement = data.input;

        if (isNull(control) || control.children.length == 0) return;

        control.children[index].className = '';

        switch (event.keyCode) {
            case 40:
                index = Math.min(index + 1, control.children.length);
                control.children[index].className = 'selected';
                break;
            case 38:
                index = Math.max(index - 1, 0);
                control.children[index].className = 'selected';
                break;
            case 13:
                input.value = control.children[index].querySelector('input').value;
                forceEvent(input, 'input');
                return;
            default:
                control.children[index].className = 'selected';
                return;
        }

        data.index = index;
    }
    function elementActionAutocomplete(element: HTMLElement, view: WView, tree: WViewActionTree, name: string) {
        var attribute: string = actionAttributeValue(element, name);
        var params: Array<string> = null;
        var value: Array<any> = null;
        var input: HTMLInputElement = null;
        var data: IElementAutocomplete = <IElementAutocomplete>{};

        if (attribute == null) return;
        params = attribute.split(SEPARATOR_PARAM);

        if (isNull(value = view.getValue(params[0])) || !(value instanceof Array)) {
            writeError('M0006', [view, name, attribute]);
            return;
        }
        if (isNull(input = element.querySelector('input')) || input.type != 'text') {
            writeError('M0008', [view, name, attribute, element]);
            return;
        }

        data.value = value;
        data.input = input;

        if (params.length > 1) data.prop = params[1];


        input.addEventListener('focusin', function () { addAutocomplete(element, data); });
        input.addEventListener('input', function () { addAutocomplete(element, data); });
        input.addEventListener('keydown', function (e) { navigateAutocomplete(element, data, e); });
        input.addEventListener('focusout', function () {
            var control: HTMLElement = data.control;
            var index: number = data.index;

            if (control && control.children.length > 0) {
                input.value = control.children[index].querySelector('input').value;
                forceEvent(input, 'input');
            }

            removeAutocomplete(data);
        });
    }
    //#endregion

    //#region Datepicker
    const DATEPICKER_TEMPLATE: string = '<table><thead><tr><th w-on-click="PreviousYear" class="normal"><</th><th w-bind="Year" colspan="5"></th><th w-on-click="NextYear" class="normal">></th></tr><tr><th w-on-click="PreviousMonth" class="normal"><</th><th w-bind="MonthName" colspan="5"></th><th w-on-click="NextMonth" class="normal">></th></tr><tr><td w-for="DayNames:Day" w-bind="Day" width="12.5%"></td></tr></thead><tbody><tr w-for="Weeks:Week"><td w-for="Week:Day" w-bind="Day.Day" w-class="DayClass:Day" w-on-click="DayClick:Day" class="normal"></td></tr></tbody></table>';
    const DATEPICKER_DAY_NAMES: Array<string> = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
    const DATEPICKER_MONTH_NAMES: Array<string> = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    var CURRENT_DATEPICKER: WView = null;

    interface IDatepickerDay {
        Day: number;
        Month: number;
    }
    interface IDatepickerData {
        Weeks: Array<Array<IDatepickerDay>>;
        Value: Date;
        Month: number;
        Year: number;
        MonthName: string;
        DayNames: Array<string>;
        Visible: boolean;
        IsDayClick: boolean;
        NextYear();
        PreviousYear();
        NextMonth();
        PreviousMonth();
        DayClick(value: IDatepickerDay);
        DayClass(value: IDatepickerDay): string;
        Parser(value: any): any;
    }

    function datepickerParser(value: any): any {
        if (value == null) return null;

        if (value instanceof Date) {
            return '' + (value.getDate() > 9 ? value.getDate() : '0' + value.getDate()) + '/' +
                (value.getMonth() > 8 ? (value.getMonth() + 1) : '0' + (value.getMonth() + 1)) + '/' +
                value.getFullYear();
        }
        else if (value.split) {
            value = value.split('/');

            if (value.length != 3 || isNaN(value[0]) || isNaN(value[1]) || isNaN(value[2])) return null;

            return new Date(+value[2], value[1] - 1, +value[0]);
        }
        else return null;
    }
    function datepickerMonthNumber(month: number, year: number) {
        if (month == 1) return 28 + (year % 4 == 0 ? 1 : 0);
        else return month % 2 == 0 ? 31 : 30;
    }
    function datepickerClose() {
        if (CURRENT_DATEPICKER) {
            if (CURRENT_DATEPICKER.data.IsDayClick == true) {
                CURRENT_DATEPICKER.data.IsDayClick = false;
                return;
            }

            CURRENT_DATEPICKER.data.IsDayClick = false;
            CURRENT_DATEPICKER.data.Visible = false;
            CURRENT_DATEPICKER.worker.refresh('Visible');
            CURRENT_DATEPICKER = null;
        }
    }

    function datepickerController($data: IDatepickerData, $worker: WViewWorker, $services: any, $params: Array<any>) {
        var element: HTMLElement = $params[0];
        var input: HTMLInputElement = $params[1];
        var control: HTMLElement = $params[2];
        var isDataChanged: boolean = true;
        var isDatepickerEvent: boolean = false;
        var id: string = actionAttributeValue(control, 'id');

        function refreshData() {
            var date: Date = new Date($data.Year, $data.Month, 1);
            var week: Array<IDatepickerDay> = null;
            var i: number = null;
            var j: number = null;

            $data.MonthName = DATEPICKER_MONTH_NAMES[$data.Month];
            $data.Weeks = [];

            date.setDate(1);
            week = [];

            if ((i = date.getDay()) > 0) {
                j = datepickerMonthNumber($data.Month == 0 ? 11 : $data.Month - 1, $data.Year - ($data.Month == 0 ? 1 : 0));
                i = j - i;

                while (j > i) { i++; week.push({ Day: i, Month: -1 }); }
            }

            i = 0;
            j = datepickerMonthNumber($data.Month, $data.Year);

            while (j > i) {
                i++;

                week.push({ Day: i, Month: 0 });

                if (week.length == 7) { $data.Weeks.push(week); week = []; }
            }

            if (week.length != 0) {
                i = 1;

                while (week.length < 7) { week.push({ Day: i, Month: 1 }); i++; }

                $data.Weeks.push(week);
            }
        }
        function showControl() {
            var date: Date = null;

            datepickerClose();
            CURRENT_DATEPICKER = <WView>OBJECTS.get(id);

            if (isDataChanged) {
                date = $data.Parser(input.value);

                if (date) $data.Value = date;
                else { date = new Date(); $data.Value = null; }

                $data.Month = date.getMonth();
                $data.Year = date.getFullYear();

                refreshData();
            }

            $data.Visible = false;

            if ($worker.created && isDataChanged) {
                $worker.refresh('Year');
                $worker.refresh('MonthName');
                $worker.refresh('Weeks');
            }
            else $worker.create();

            $data.Visible = true;
            $worker.refresh('Visible');
        }
        function inputValueChanged() {
            if (isDatepickerEvent) return;

            isDataChanged = true;
            isDatepickerEvent = false;
        }

        $data.DayNames = DATEPICKER_DAY_NAMES;
        $data.NextYear = function () {
            $data.Year++;

            refreshData();

            $worker.refresh('Year');
            $worker.refresh('Weeks');
        }
        $data.PreviousYear = function () {
            $data.Year--;

            refreshData();

            $worker.refresh('Year');
            $worker.refresh('Weeks');
        }
        $data.NextMonth = function () {
            var changeYear: boolean = $data.Month == 11;

            if (changeYear) { $data.Year++; $data.Month = 0; }
            else $data.Month++;

            refreshData();

            if (changeYear) $worker.refresh('Year');
            $worker.refresh('MonthName');
            $worker.refresh('Weeks');
        }
        $data.PreviousMonth = function () {
            var changeYear: boolean = $data.Month == 0;

            if (changeYear) { $data.Year--; $data.Month = 11; }
            else $data.Month--;

            refreshData();

            if (changeYear) $worker.refresh('Year');
            $worker.refresh('MonthName');
            $worker.refresh('Weeks');
        }
        $data.DayClick = function (value: IDatepickerDay) {
            var changeYear: boolean;

            if (value.Month == 0) {
                $data.Value = new Date($data.Year, $data.Month, value.Day);
                $worker.refresh('DayClass');
            }
            else if (value.Month > 0) {
                changeYear = $data.Month == 11;

                if (changeYear) { $data.Year++; $data.Month = 0; }
                else $data.Month++;
            }
            else {
                changeYear = $data.Month == 0;

                if (changeYear) { $data.Year--; $data.Month = 11; }
                else $data.Month--;
            }

            $data.Value = new Date($data.Year, $data.Month, value.Day);

            if (value.Month != 0) {
                refreshData();

                if (changeYear) $worker.refresh('Year');
                $worker.refresh('MonthName');
                $worker.refresh('Weeks');
            }

            isDatepickerEvent = true;
            input.value = $data.Parser($data.Value);
            forceEvent(input, 'input');
            input.focus();
        }
        $data.DayClass = function (value: IDatepickerDay): string {
            if (value.Month != 0) return 'other';

            return ($data.Value && $data.Year == $data.Value.getFullYear() && $data.Month == $data.Value.getMonth() && value.Day == $data.Value.getDate()) ? 'selected' : '';
        }
        $data.Parser = $params.length > 3 ? $params[3] : datepickerParser;

        input.addEventListener('focusin', showControl);
        input.addEventListener('input', inputValueChanged);
        input.addEventListener('keydown', datepickerClose);
        element.addEventListener('click', function () { $data.IsDayClick = true; });
        $worker.setEventListener('beforeCreate', function () { control.style.display = 'block'; });
    }
    function elementActionDatepicker(element: HTMLElement, view: WView, tree: WViewActionTree, name: string) {
        var attribute: string = actionAttributeValue(element, name);
        var value: any = null;
        var params: Array<HTMLElement> = [];
        var input: HTMLInputElement = null;
        var control: HTMLElement = null;

        try {
            if (isNull(attribute)) return;

            if (isNull(input = element.querySelector('input')) || input.type != 'text') {
                writeError('M0008', [view, name, attribute, element]);
                return;
            }

            control = document.createElement('div');
            control.className = 'datepicker';
            control.setAttribute(ATTR_PREFIX + 'if', 'Visible');
            control.style.display = 'none';
            element.appendChild(control);

            params = [element, input, control];


            if (attribute != '') {
                if (isNull(value = view.getValue(attribute))) {
                    writeError('M0006', [view, name, attribute]);
                    return;
                }
                params.push(value);
            }

            executeView(CONFIGS.get('Datepicker'), control, new WViewActionTree(), params);
        }
        catch (error) {
            writeError('M0007', [view, name, attribute, error]);
        }
    }
    //#endregion

    //#region Modal
    var CURRENT_MODAL_ARRAY: Array<WModal> = [];

    export interface IModalService {
        readonly instance: IModalWorker;

        create(name: string, params?: Array<any>): IModalWorker
    }
    export interface IModalWorker {
        isVisible: boolean

        show();
        hide(parameters?: Array<any>, showLastModal?: boolean);
        close(parameters?: Array<any>);

        setEventListener(name: string, callback: Function);
    }

    class WModal extends WBase implements IModalWorker {
        private parent: WView;
        private view: WView;
        private isForced: boolean = false;

        public isVisible: boolean = false;

        private remove() {
            var i: number = null;
            var c: number = CURRENT_MODAL_ARRAY.length;

            for (i = 0; i < c; i++)
                if (CURRENT_MODAL_ARRAY[i].id == this.id)
                    break;
            if (i != c) CURRENT_MODAL_ARRAY.splice(i, 1);
        }

        public show() {
            this.view.invoke('beforeShow');

            if (CURRENT_MODAL_ARRAY.length > 0) {
                if (CURRENT_MODAL_ARRAY[0].isVisible) CURRENT_MODAL_ARRAY[0].hide(null, false, true);
                this.remove();
            }

            CURRENT_MODAL_ARRAY.unshift(this);

            document.body.style.overflow = 'hidden';
            this.view.element.style.display = 'block';
            this.isVisible = true;

            this.view.invoke('afterShow');
        }
        public hide(parameters?: Array<any>, showLastModal?: boolean, isForced?: boolean) {
            var i: number;
            var c: number;

            this.view.invoke('beforeHide', parameters);
            this.view.element.style.display = 'none';
            this.view.invoke('afterHide', parameters);
            this.isForced = isForced;
            this.isVisible = false;

            if (!isFalse(showLastModal)) {
                i = 0;
                c = CURRENT_MODAL_ARRAY.length;

                while (i < c) {
                    if (CURRENT_MODAL_ARRAY[i].id != this.id && isTrue(CURRENT_MODAL_ARRAY[i].isForced)) {
                        CURRENT_MODAL_ARRAY[i].show();
                        return;
                    }
                    i++;
                }
            }

            document.body.style.overflow = 'visible';
        }
        public close(parameters?: Array<any>) {
            this.view.invoke('beforeClose', parameters);
            this.hide();
            this.remove();
            this.view.dispose();
            document.body.removeChild(this.view.element);
            this.view.invoke('afterClose', parameters);
        }
        public setEventListener(name: string, callback?: Function) {
            this.view.setEventListener(this.parent, name, callback);
        }

        constructor(parent: WView, name: string, element: HTMLElement, params: Array<any>) {
            super('Modal/' + name)
            var self: WModal = this;
            var extra: WDictionary<any> = new WDictionary({ type: 'modal', id: this.id });

            OBJECTS.set(this.id, this);

            this.parent = parent;
            this.view = executeView(CONFIGS.get(name), element, new WViewActionTree(), params, extra);
            this.view.setEventListener(this, 'beforeRemove', function () { OBJECTS.set(self.id, null); });
        }
    }
    class WModalService implements IModalService {
        public readonly instance: WModal;

        private view: WView;

        public create(name: string, params?: Array<any>): IModalWorker {
            if (CONFIGS.get(name)) {
                var view: WView;
                var element: HTMLElement = document.createElement('div');

                element.className = 'modal';
                element.style.display = 'none';
                document.body.appendChild(element);

                return new WModal(this.view, name, element, params);
            }
            else writeError('M0011', [this.view, name]);
        }

        constructor(view: WView, instance?: WModal) {
            this.view = view;
            this.instance = instance;
        }
    }

    function serviceModal(view: WView): IModalService {
        return new WModalService(view, view.extra.get('type') == 'modal' ? <WModal>OBJECTS.get(view.extra.get('id')) : null);
    }
    //#endregion

    //#region Csv
    const CSV_SPLIT_CHAR: string = '\\';
    const CSV_SPLIT_COLUMN: string = '|';
    const CSV_SPLIT_ROW: string = '¬';
    const CSV_SPLIT_BLOCK: string = '^';
    const CSV_HEADER_NAMES: Array<string> = ['Name', 'TypeName'];

    export interface ICsvData {
        name: string,
        value: string,
        length: number,
        index: number,
        headers: Array<ICsvDataHeader>,
        names: Array<string>,
        items: Array<any>
    }
    export interface ICsvDataHeader {
        Name: string,
        TypeName: string,
        TypeParser(value: any): any;
    }
    export interface ICsvParseResult<T> {
        Headers: Array<ICsvDataHeader>;
        Items: Array<T>
    }
    export interface ICsvService {
        split(value: string, container: any): boolean;
    }

    function csvParseInt(value: string): number {
        if (value) {
            return parseInt(value);
        }
        return null;
    }
    function csvParseDecimal(value: string): number {
        if (value) {
            return parseFloat(value);
        }
        return null;
    }
    function csvParseDate(value: string): Date {
        if (value) {
            return new Date(parseInt(value));
        }
        return null;
    }
    function csvParseBoolean(value: string): boolean {
        if (value) {
            return value == '1';
        }
        return null;
    }
    function csvParseString(value: string): string {
        return value;
    }

    function csvParser(typeName: string): Function {
        switch (typeName.toLowerCase()) {
            case 'int':
                return csvParseInt;
            case 'decimal':
                return csvParseDecimal;
            case 'bit':
                return csvParseBoolean;
            case 'date':
            case 'datetime':
                return csvParseDate;
            default:
                return csvParseString;
        }
    }

    function csvSplitName(data: ICsvData) {
        var i: number = data.index;
        var value: string = null;

        data.name = '';

        while (i < data.length) {
            value = data.value[i];

            if (value == CSV_SPLIT_CHAR && data.value[i + 1] == CSV_SPLIT_BLOCK) break;

            data.name += value;
            i++;
        }

        data.index = i + 2;
    }
    function csvSplitProps(data: ICsvData) {
        var i: number = data.index;
        var value: string = null;
        var cell: string = '';
        var names: Array<string> = [];

        if (data.value[i] == CSV_SPLIT_CHAR && data.value[i + 1] == CSV_SPLIT_BLOCK) {
            data.names = CSV_HEADER_NAMES;
            data.index = i + 2;
            return;
        }

        while (i < data.length) {
            value = data.value[i];

            if (value == CSV_SPLIT_CHAR) {
                i++; value = data.value[i]; i++;

                if (value == CSV_SPLIT_COLUMN) {
                    names.push(cell);
                    continue;
                }
                else if (value == CSV_SPLIT_BLOCK) {
                    names.push(cell);
                    break;
                }
                else {
                    cell += CSV_SPLIT_CHAR; i--;
                    continue;
                }
            }

            cell += value;
            i++;
        }

        data.index = i;
        data.names = CSV_HEADER_NAMES.concat(names);
    }
    function csvSplitHeaders(data: ICsvData) {
        var headers: Array<ICsvDataHeader> = [];
        var i: number = data.index;
        var j: number = 0;
        var c: number = 0;
        var value: string = null;
        var cell: string = '';
        var isFirstRow: boolean = true;
        var header: ICsvDataHeader;

        while (i < data.length) {
            value = data.value[i];

            if (value == CSV_SPLIT_CHAR) {
                i++; value = data.value[i]; i++;

                if (value == CSV_SPLIT_COLUMN) {
                    if (isFirstRow) headers.push((header = <ICsvDataHeader>{}));
                    else header = headers[j];
                    header[data.names[c]] = cell; j++; cell = '';
                    continue;
                }
                else if (value == CSV_SPLIT_ROW) {
                    if (isFirstRow) { headers.push((header = <ICsvDataHeader>{})); isFirstRow = false; }
                    else header = headers[j];
                    header[data.names[c]] = cell; j = 0; c++; cell = '';
                    continue;
                }
                else if (value == CSV_SPLIT_BLOCK) {
                    if (isFirstRow) headers.push((header = <ICsvDataHeader>{}));
                    else header = headers[j];
                    header[data.names[c]] = cell;
                    break;
                }
                else {
                    cell += CSV_SPLIT_CHAR; i--;
                    continue;
                }
            }

            cell += value;
            i++;
        }

        data.index = i;
        data.headers = headers;

        c = headers.length;
        for (i = 0; i < c; i++) headers[i].TypeParser = <any>csvParser(headers[i].TypeName);
    }
    function csvSplitItems(data: ICsvData) {
        var headers: Array<ICsvDataHeader> = data.headers;
        var i: number = data.index;
        var j: number = 0;
        var value: string = null;
        var cell: string = '';
        var row: any = {};
        var items: Array<any> = [];

        if (data.value[i] == CSV_SPLIT_CHAR && data.value[i + 1] == CSV_SPLIT_BLOCK) {
            data.items = items;
            data.index = i + 2;
            return;
        }

        while (i < data.length) {
            value = data.value[i];

            if (value == CSV_SPLIT_CHAR) {
                i++; value = data.value[i]; i++;

                if (value == CSV_SPLIT_COLUMN) {
                    row[headers[j].Name] = headers[j].TypeParser(cell); j++; cell = '';
                    continue;
                }
                else if (value == CSV_SPLIT_ROW) {
                    row[headers[j].Name] = headers[j].TypeParser(cell); j = 0; cell = '';
                    items.push(row); row = {};
                    continue;
                }
                else if (value == CSV_SPLIT_BLOCK) {
                    row[headers[j].Name] = headers[j].TypeParser(cell);
                    items.push(row);
                    break;
                }
                else {
                    cell += CSV_SPLIT_CHAR; i--;
                    continue;
                }
            }

            cell += value;
            i++;
        }
        /*
        if (i == data.length) {
            row[headers[j].Name] = headers[j].TypeParser(cell);
            items.push(row);
        }
        */
        data.index = i;
        data.items = items;
    }

    class CsvService implements ICsvService {
        private view: WView;

        public split(value: string, container: any): boolean {
            var data: ICsvData = <ICsvData>{ value: value, length: value.length, index: 0 };
            var temp: any = {};
            var key: string;

            try {
                while (data.index < data.length) {
                    csvSplitName(data);
                    csvSplitProps(data);
                    csvSplitHeaders(data);
                    csvSplitItems(data);

                    temp[data.name] = { Headers: data.headers, Items: data.items };
                }

                for (key in temp) container[key] = temp[key];

                return true;
            }
            catch (error) {
                writeError('M0012', [this.view, data, error]);
                return false;
            }
        }

        constructor(view: WView) {
            this.view = view;
        }
    }

    function serviceCsv(view: WView): ICsvService {
        return new CsvService(view);
    }
    //#endregion

    //#region Wait
    export interface IWaitService {
        set(value: boolean);
    }

    class WaitService {
        private view: WView;

        public set(value: boolean) {
            if (isTrue(value)) {
                this.view.element.className = (this.view.element.className ? (this.view.element.className + ' ') : '') + 'view-wait';
            }
            else if (isFalse(value)) {
                this.view.element.className = this.view.element.className.replace(/\bview-wait\b/g, "");
            }
        }

        constructor(view: WView) {
            this.view = view;
        }
    }

    function serviceWait(view: WView) {
        return new WaitService(view);
    }
    //#endregion

    //#region MessageBox
    const MESSAGE_BOX_TEMPLATE: string = '<div class="content sm"><div class="title" w-bind="Title"></div><div class="body" w-bind="Message"></div><div class="footer"><button type="button" class="btn btn-sm" w-on-click="Ok">Ok</button><button type="button" class="btn btn-sm" w-on-click="Cancel" w-if="HasCancel" style="margin-left:5px;">Cancel</button></div></div>';
    export interface IMessageBoxData {
        Title: string;
        Message: string;
        HasCancel: boolean;
        Callback: Function;

        Ok();
        Cancel();
    }

    function MessageBoxController($data: IMessageBoxData, $worker: IViewWorker, $services: IReadOnlyDictionary<any>, $params: Array<any>) {
        var $modal: IModalService = $services.get('modal');
        var param: IMessageBoxData;

        function fnInit() {
            $data.HasCancel = false;
            $data.Message = 'Mensaje del sistema';
            $data.Title = 'Mensaje del sistema';

            param = (isNotNull($params) && $params.length > 0) ? $params[0] : null;

            $worker.setEventListener('beforeShow', fnRefreshData);
        }
        function fnRefreshData() {
            var key: string;

            if (isNotNull(param)) {
                for (key in param) {
                    $data[key] = param[key];
                }
            }

            $worker.create();
        }

        $data.Ok = function () {
            if (isTrue($data.HasCancel) && isNotNull($data.Callback)) {
                $data.Callback.call(null, true);
            }
            $modal.instance.hide([true], true);
        }
        $data.Cancel = function () {
            if (isTrue($data.HasCancel) && isNotNull($data.Callback)) {
                $data.Callback.call(null, false);
            }
            $modal.instance.hide([false], true);
        }

        fnInit();
    }
    //#endregion

    //#region Objects
    export const INTEROP: WDictionary<any> = new WDictionary<any>();

    const DEBUG: WDictionary<any> = new WDictionary<any>();
    const OBJECTS: WDictionary<WBase> = new WDictionary<WBase>();
    const EVENTS: WEvent = new WEvent();

    const CONFIGS: WDictionary<WViewConfig> = new WDictionary<WViewConfig>();
    const SERVICES: WDictionary<IServiceConfiguration> = new WDictionary<IServiceConfiguration>();
    const SCOPE_ACTIONS: WDictionary<IScopeAction> = new WDictionary<IScopeAction>();
    const ELEMENT_ACTIONS: WDictionary<IElementAction> = new WDictionary<IElementAction>();

    const FIRST_VIEW: IDOMView = <IDOMView>{};
    //#endregion

    function init() {

        //#region Core
        window.addEventListener('load', windowLoad);

        INTEROP.set('debug', DEBUG);

        addService({ name: 'event', service: serviceEvent });
        addService({ name: 'http', service: serviceHttp });

        addScopeAction({ name: 'view', action: scopeActionView });
        addScopeAction({ name: 'for', action: scopeActionFor });

        addElementAction({ name: 'attr', action: elementActionAttr });
        addElementAction({ name: 'bind', action: elementActionBind });
        addElementAction({ name: 'if', action: elementActionIf });
        addElementAction({ name: 'enabled', action: elementActionEnabled });
        addElementAction({ name: 'style', action: elementActionStyle });
        addElementAction({ name: 'class', action: elementActionClass });
        addElementAction({ name: 'model', action: elementActionModel });
        addElementAction({ name: 'on', action: elementActionOn });
        addElementAction({ name: 'create', action: elementActionCreate });
        //#endregion Core

        //#region Autocomplete
        addElementAction({ name: 'autocomplete', action: elementActionAutocomplete });
        //#endregion

        //#region Datepicker
        addController({ name: 'Datepicker', controller: datepickerController, params: { autoCreate: false, template: DATEPICKER_TEMPLATE } });
        addElementAction({ name: 'datepicker', action: elementActionDatepicker });
        document.body.addEventListener('click', datepickerClose);
        //#endregion

        //#region Modal
        addService({ name: 'modal', service: serviceModal });
        //#endregion

        //#region Csv
        addService({ name: 'csv', service: serviceCsv });
        //#endregion

        //#region Wait
        addService({ name: 'wait', service: serviceWait });
        //#endregion

        //#region MessageBox
        addController({ name: 'MessageBox', controller: MessageBoxController, params: { services: ['modal'], template: MESSAGE_BOX_TEMPLATE } });
        //#endregion
    }

    init();
}