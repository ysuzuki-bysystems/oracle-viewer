# oracle
docker run --cpuset-cpus="0-7" -eORACLE_PWD='Passw0rd' -vlocal-orcl-data:/opt/oracle/oradata --name local-orcl -d container-registry-tokyo.oracle.com/database/express:18.4.0-xe
