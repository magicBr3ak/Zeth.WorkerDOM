namespace WorkerDOM {

    var Debug: IDictionary<any> = INTEROP.get('debug');

    function msgAlreadyExistsEvent(event: IBase, source: IBase, name: string) {
        return event.getFullName() + ': There is already a event for "' + name + '" with this source: ' + source.getFullName();
    }
    function msgDoesNotExistsService(source: IBase, name: string): string {
        return source.getFullName() + ': There is no service registered with the name "' + name + '".';
    }
    function msgAlreadyExistsAction(name: string) {
        return 'Core: There is already an action with the name "' + name + '".';
    }
    function msgAlreadyExistsService(name: string) {
        return 'Core: There is already a service with the name "' + name + '".';
    }
    function msgAlreadyExistsConfig(name: string) {
        return 'Core: There is already a view configuration with the name "' + name + '".';
    }
    function msgDoesNotExistsConfig(source: IBase, name: string): string {
        return source.getFullName() + ': There is no config registered with the name "' + name + '".';
    }
    function msgWrongParametersCount(source: IBase, name: string, attribute: string): string {
        return source.getFullName() + ': Wrong number of parameters in the action "' + name + '" with value "' + attribute + '".';
    }
    function msgWrongParameterValue(source: IBase, name: string, attribute: string): string {
        return source.getFullName() + ': Wrong value in the action "' + name + '" with value "' + attribute + '".';
    }
    function msgFailedAtAction(source: IBase, name: string, attribute: string, error: Error): string {
        console.error(error);
        return source.getFullName() + ': Failed at executing the action "' + name + '" with value "' + attribute + '".';
    }
    function msgWrongElement(source: IBase, name: string, attribute: string, element: HTMLElement): string {
        return source.getFullName() + ': The element "' +  element.tagName+ '" can not implement the action "' + name + '" with value "' + attribute + '".';
    }
    function msgNullValue(source: IBase, name: string, attribute: string): string {
        return source.getFullName() + ': Null value in the action "' + name + '" with value "' + attribute + '".';
    }
    function msgFailedAtSplit(source: IBase, data: ICsvData, error: Error): string {
        console.error(error);
        return source.getFullName() + ': Failed at spliting at the index "' + data.index + '" in the following data: \n' + data.value; 
    }

    Debug.set('M0001', msgAlreadyExistsEvent);
    Debug.set('M0002', msgDoesNotExistsService);
    Debug.set('M0003', msgAlreadyExistsAction);
    Debug.set('M0004', msgAlreadyExistsService);
    Debug.set('M0005', msgWrongParametersCount);
    Debug.set('M0006', msgWrongParameterValue);
    Debug.set('M0007', msgFailedAtAction);
    Debug.set('M0008', msgWrongElement);
    Debug.set('M0009', msgAlreadyExistsConfig);
    Debug.set('M0010', msgNullValue);
    Debug.set('M0011', msgDoesNotExistsConfig);
    Debug.set('M0012', msgFailedAtSplit); 
}