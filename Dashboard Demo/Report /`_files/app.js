var app = angular.module('myApp',['ngMessages','daterangepicker']);

app.controller("mainController", function($scope, $http) {
	$scope.init = function () {
	 	$scope.loading = true

		$http({
			method:'POST',
			data : $scope.formData,
			url : 'http://143.198.213.74/report/index.php/admin/Reportingcontroller/hourlywise',
			headers : {'Content-Type': 'application/json '}
		}).success(function(res){
			if (res.status=='Failure') {
				alert('No result Found')
			}else{
				var myEl = angular.element( document.querySelector( '.Dataoftable' ) ); 
				myEl.empty();
			
				$scope.result = res.clicks;	
				$scope.unique  = res.unique;	
				$scope.act = res.act;
				$scope.parkact = res.parkact;
				$scope.parking = res.parking;
				$scope.dct = res.dct;
				$scope.ren = res.ren;
				$scope.actrev = res.actrev;
				$scope.renrev = res.renrev;
				$scope.totalrevenue = res.totalrevenue;
				$scope.senttopartners = res.senttopartners;
			}
		})
	};
});


app.controller('myCtrl',function($scope,$http){

// inside app.controller('myCtrl', function($scope, $http) { ... })

// initialize list
$scope.productList = [];

// load operator's products
$scope.loadProducts = function(operatorId) {
    // clear previous selection & products
    $scope.formData = $scope.formData || {};
    $scope.formData.pid = "";
    $scope.productList = [];

    if (!operatorId) {
        // no operator selected — keep product list empty
        return;
    }

    $http({
        method: 'POST',
        url: 'http://143.198.213.74/report/index.php/admin/Reportingcontroller/getProductsByOperator',
        data: { operator_id: operatorId },
        headers: {'Content-Type': 'application/json '}
    }).then(function(res) {
        // expect res.data.products = array
        if (res.data && Array.isArray(res.data.products) && res.data.products.length > 0) {
            $scope.productList = res.data.products;
        } else {
            // If no mapped products were returned, productList stays empty
            // User can still submit with product blank -> backend should treat as "all products"
            $scope.productList = [];
            // Optional: inform user (commented out to keep UX clean)
            // alert('No products configured for this operator. Report will include all products for selected operator.');
        }
    }, function(err){
        console.error('Failed to load products', err);
        $scope.productList = [];
    });
};


$scope.operatorList = [];

$scope.loadOperatorsByCountry = function(countryId) {
    $scope.operatorList = [];
    $scope.productList  = [];
    $scope.formData.operator_id = "";
    $scope.formData.pid = "";

    if (!countryId) return;

    $http({
        method: 'POST',
        url: 'http://143.198.213.74/report/index.php/admin/Reportingcontroller/getOperatorsByCountry',
        data: { country_id: countryId },
        headers: {'Content-Type': 'application/json'}
    }).then(function(res) {
        if (res.data && Array.isArray(res.data.operators)) {
            $scope.operatorList = res.data.operators;
        }
    }, function() {
        $scope.operatorList = [];
    });
};

$scope.countryList = [];

$http.get('http://143.198.213.74/report/index.php/admin/Reportingcontroller/getCountries')
.then(function(res){
    $scope.countryList = res.data;
});

$scope.networkList = [];

$http.get('http://143.198.213.74/report/index.php/admin/Reportingcontroller/getNetwork')
.then(function(res){
    $scope.networkList = res.data;
});

$scope.aggrList = [];

$http.get('http://143.198.213.74/report/index.php/admin/Reportingcontroller/getAggr')
.then(function(res){
    $scope.aggrList = res.data;
});

$scope.currencyList = [];

$http.get('http://143.198.213.74/report/index.php/admin/Reportingcontroller/getCurrency')
.then(function(res){
    $scope.currencyList = res.data;
});



$scope.loadPricePoint = function(operatorId, productId) {
    console.log('loadPricePoint called', operatorId, productId);

    $scope.pricePointList = [];

    if (!operatorId || !productId) {
        return;
    }

    $http({
        method: 'POST',
        url: 'http://143.198.213.74/report/index.php/admin/Reportingcontroller/getPricepointDetails',
        data: {
            operator_id: operatorId,
            pricepoint: productId
        },
        headers: { 'Content-Type': 'application/json' }
    }).then(function(res) {
        if (res.data && Array.isArray(res.data.pricepoints)) {
            $scope.pricePointList = res.data.pricepoints;
        } else {
            $scope.pricePointList = [];
        }
    }, function(err) {
        console.error('Failed to load pricepoint', err);
        $scope.pricePointList = [];
    });
};



	$scope.submitdashboard = function(){
			$scope.loading = true			
			$http({
				method : 'POST' ,
				url : 'http://143.198.213.74/report/index.php/admin/Reportingcontroller/dashboardreporting',
				data :$scope.formData,
				headers: {'Content-Type': 'application/json '}
			}).success(function(response){
				
				if (response.status=='Failure') {
					alert('No result Found')
				}else{
					var myEl = angular.element( document.querySelector( '.Dataoftable' ) ); 
					myEl.empty();				
					$scope.result = response;	
				}				 
			})
	};

	// Remaining functions unchanged...

	$scope.submitdashboard = function(){
			$scope.loading = true
			
			//console.log([{"key":1,"val":"MENS WEAR"},{"key":2,"val":"WOMENS WEAR"},{"key":3,"val":"Kids WEAR"}]);
			$http({
				method : 'POST' ,
				url : 'http://143.198.213.74/report/index.php/admin/Reportingcontroller/dashboardreporting',
				data :$scope.formData  ,
				headers: {'Content-Type': 'application/json '}
			}).success(function(response){
				console.log(response)
				var count = Object.keys(response).length;
				if (response.status=='Failure') {
					alert('No result Found')
				}else{
					var myEl = angular.element( document.querySelector( '.Dataoftable' ) ); 
					 myEl.empty();
				
					$scope.result = response;	
				}
				 
			})

	};

	$scope.submitPricepointdashboard = function () {
    $scope.loading = true;

    $http({
        method: 'POST',
        url: 'http://143.198.213.74/report/index.php/admin/Reportingcontroller/getPricepointWiseReport',
        data: $scope.formData,
        headers: { 'Content-Type': 'application/json' }
    }).then(function (res) {

        if (!res.data || !res.data.data || res.data.data.length === 0) {
            alert('No result Found');
            return;
        }

        /* Dynamic AMT headers */
        $scope.amounts = res.data.amounts;
		console.log(res.data.currency)
        /* Table rows */
        $scope.result = res.data.data;
		$scope.currency = res.data.currency;

        $scope.loading = false;
    }, function () {
        alert('Server Error');
        $scope.loading = false;
    });
};

$scope.createcampaign1 = function () {

    let payload = angular.copy($scope.formData);

    payload.countryname  = $scope.formData.country_id;
    payload.operatorname = $scope.formData.operator_id;
    payload.cat          = $scope.formData.pid;   // product
    payload.net_name     = $scope.formData.net_name; // network dropdown (PHP)
	payload.aggre        = $scope.formData.aggregator_id;    
	payload.currency 	 = $scope.formData.currency;
	
    console.log('FINAL PAYLOAD →', payload); // 🔥 DEBUG

    $http({
        method: 'POST',
        url: 'http://143.198.213.74/report/index.php/admin/Reportingcontroller/createcampaign',
        data: payload,
        headers: { 'Content-Type': 'application/json' }
    }).then(function (res) {

        if (res.data.status === 'success') {
            alert('Campaign created successfully');
            $scope.url = res.data.url;
            $scope.createcampaign.$setPristine();
            $scope.createcampaign.$setUntouched();
        } else {
            alert(res.data.msg);
        }

    }, function (err) {
        console.error(err);
    });
};

	$scope.testS2sCampaign=function(){
		$scope.loading = true

		$http({
			method:'POST',
			data :$scope.formData ,
			url:'http://143.198.213.74/report/campaign-manager/test_s2s_action',
			headers : {'Content-Type': 'application/json '}
		}).success(function(response){
				
				$('.myresponse').html(response)
			
		})
	}

	$scope.createapicampaign1=function(){
		
		$scope.loading = true
		$http({
			method:'POST',
			data :$scope.formData ,
			url: 'create-api-campaign-action',
			headers : {'Content-Type': 'application/json '}
		}).success(function(response){
			console.log(response.msg)
			if (response.status=='success') {
				alert('successfully created')
				$("#createapicampaign")[0].reset();
				$('.help-block').css("display","block !important");
				$scope.url = response.msg;
			}else{
				alert(response.msg)
			}
		})
	}
	$scope.addadnetwork1 = function(){
		$scope.loading=true
		$http({
			method:'POST',
			data:$scope.formData,
			url:'http://143.198.213.74/report/index.php/admin/Reportingcontroller/addadnetwork',
			headers : {'Content-Type': 'application/json '}
		}).success(function(response){
			console.log(response)
			if (response.status=='Success'){
				$("#addadnetwork")[0].reset();
				alert('Network Added')
			}else{
				alert('Error')
			}
		})
	}
	/////////////////
	$scope.sendtopartnercontroll=function(){
		
		$scope.loading = true

		$http({
			method:'POST',
			data : $scope.formData,
			url : 'http://143.198.213.74/report/index.php/admin/Reportingcontroller/sendtopartnercontroll',
			headers : {'Content-Type': 'application/json '}
		}).success(function(res){
			alert(res.status)
			console.log(res.status)
			location.reload();
		})
	}
	/////////////////
		$scope.hourlyreport=function(){
		//alert('gaurav');
		$scope.loading = true

		$http({
			method:'POST',
			data : $scope.formData,
			url : 'http://143.198.213.74/report/index.php/admin/Reportingcontroller/hourlywise',
			headers : {'Content-Type': 'application/json '}
		}).success(function(res){
			//alert(res)
			//console.log(res);
			//var count = Object.keys(res).length;
			
				if (res.status=='Failure') {
					alert('No result Found')
				}else{
					var myEl = angular.element( document.querySelector( '.Dataoftable' ) ); 
					 myEl.empty();
				
					$scope.result = res.clicks;	
					$scope.unique  = res.unique;	
					$scope.act = res.act;
					$scope.parkact = res.parkact;
					$scope.parking = res.parking;
					$scope.dct = res.dct;
					$scope.ren = res.ren;
					$scope.actrev = res.actrev;
					$scope.renrev = res.renrev;
					$scope.totalrevenue = res.totalrevenue;
					$scope.senttopartners = res.senttopartners;

				}

		})
	} 
	////////////////////
	$scope.login= function(){

			$http({
			method:'POST',
			data : $scope.formdata,
			url : 'http://143.198.213.74/report/index.php/admin/Reportingcontroller/login',
			headers : {'Content-Type': 'application/json '}
		}).success(function(res){
			//alert(res)
			console.log(res);
			//var count = Object.keys(res).length;
			
				if (res.status=='Failure') {
					alert('Username or password Wrong')
				}else{
					//window.location = 'http://143.198.213.74/report/index.php/admin/admin/';
					window.location = 'http://143.198.213.74/report/index.php/admin/admin/meindex';
				}

		})

	}
	//////////////

	
	$scope.tpayreportget = function(){
		
			$http({
			method : 'POST',
			data : $scope.formData,
			url : 'http://143.198.213.74/report/index.php/admin/Reportingcontroller/tpayreport',
			headers : {'Content-Type': 'application/json '}
		}).success(function(res){
			
			if (res.status=='Failure') {
					alert('No result Found')
				}else{
					var myEl = angular.element( document.querySelector( '.Dataoftable' ) ); 
					 myEl.empty();
					$scope.result = res.dataresult;	
					
				}
		})
	}
	//////////////
	$scope.senttopartner= function(){
		
		$http({
			method : 'POST',
			data : $scope.formData,
			url : 'http://143.198.213.74/report/index.php/admin/Reportingcontroller/senttopartner',
			headers : {'Content-Type': 'application/json '}
		}).success(function(res){
			console.log(res)
			if (res.status=='Failure') {
					alert('No result Found')
				}else{
					var myEl = angular.element( document.querySelector( '.Dataoftable' ) ); 
					 myEl.empty();
					
					$scope.result = res.dataresult;	
					
				}
		})
	}
})

/*
var app = angular.module('myDemo',['ngMessages','daterangepicker']);

app.controller('demoCtrl',function($scope,$http){

	$scope.demo = function () {
	   alert('hi');
	   console.log('hi');
	};
})*/



