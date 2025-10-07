select * from auth_scheme limit 100 ;
select * from auth_scheme_flow limit 100 ;
select * from auth_scheme_hit limit 100 ;
select * from auth_scheme_rule limit 100 ;
select * from auth_scheme_rule_hit limit 100 ;
select * from auth_scheme_rule_value    limit 100 ;
select * from auth_scheme_rule_value_hit limit 100 ;


CREATE TABLE auth_scheme_bak_20250918 as select * from auth_scheme;
CREATE TABLE auth_scheme_flow_bak_20250918 as select * from auth_scheme_flow;
CREATE TABLE auth_scheme_rule_bak_20250918 as select * from auth_scheme_rule;
CREATE TABLE auth_scheme_rule_value_bak_20250918 as select * from auth_scheme_rule_value;

TRUNCATE TABLE auth_scheme;
TRUNCATE TABLE auth_scheme_flow;
TRUNCATE TABLE auth_scheme_rule;
TRUNCATE TABLE auth_scheme_rule_value;


--  删除执行未成功已创建的授权方案
select * from  auth_scheme WHERE st='01';
delete from auth_scheme WHERE st='01';


-- 审批转授权迁移
-- 授权数据模型
select * from  ecms_workflow.auth_data_model    ;
-- 数据变量表
select * from  ecms_workflow.auth_data_model_arg_inf    where dataset_numb in(
    select dataset_numb from  ecms_workflow.auth_data_model_data_set    where dataset_eng_num = 'crlmtAuthorize'
    );
-- 数据集
select * from  ecms_workflow.auth_data_model_data_set    where dataset_eng_num = 'crlmtAuthorize';
-- 授权方案表
select * from  ecms_workflow.auth_scheme    where scm_numb = 'SQBH1736471348381';
-- 授权流程关联表
select * from  ecms_workflow.auth_scheme_flow where scm_numb = 'SQBH1736476258103' and model_key = 'WF_D_PCE_000004' and tenant_id = '90099000' and del_ind = '0';
-- 授权方案规则表
select * from  ecms_workflow.auth_scheme_rule    where scm_numb = 'SQBH1736471348381';
-- 授权方案规则明细表
select * from  ecms_workflow.auth_scheme_rule_value    where scm_numb = 'SQBH1736471348381' and del_ind = '0';
-- 授权方案模板表
select * from  ecms_workflow.auth_scheme_template;
-- 其他参数迁移
-- 租户表
select * from  ecms_workflow.wf_tenant    ;
-- 流程审批互斥配置
select * from  ecms_workflow.workflow_muexl_aprv    ;
-- 按钮自定义设置表
select * from  ecms_workflow.wf_defined_button    ;
-- 系统通用参数表
select * from  ecms_workflow.act_ge_property;