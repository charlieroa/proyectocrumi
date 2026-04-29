
package com.dian.client;

import java.util.ArrayList;
import java.util.List;
import javax.xml.bind.annotation.XmlAccessType;
import javax.xml.bind.annotation.XmlAccessorType;
import javax.xml.bind.annotation.XmlElement;
import javax.xml.bind.annotation.XmlType;


/**
 * <p>Java class for ArrayOfValidacionDoc complex type.
 * 
 * <p>The following schema fragment specifies the expected content contained within this class.
 * 
 * <pre>
 * &lt;complexType name="ArrayOfValidacionDoc">
 *   &lt;complexContent>
 *     &lt;restriction base="{http://www.w3.org/2001/XMLSchema}anyType">
 *       &lt;sequence>
 *         &lt;element name="ValidacionDoc" type="{http://schemas.datacontract.org/2004/07/ValidacionDoc}ValidacionDoc" maxOccurs="unbounded" minOccurs="0"/>
 *       &lt;/sequence>
 *     &lt;/restriction>
 *   &lt;/complexContent>
 * &lt;/complexType>
 * </pre>
 * 
 * 
 */
@XmlAccessorType(XmlAccessType.FIELD)
@XmlType(name = "ArrayOfValidacionDoc", namespace = "http://schemas.datacontract.org/2004/07/ValidacionDoc", propOrder = {
    "validacionDoc"
})
public class ArrayOfValidacionDoc {

    @XmlElement(name = "ValidacionDoc", nillable = true)
    protected List<ValidacionDoc> validacionDoc;

    /**
     * Gets the value of the validacionDoc property.
     * 
     * <p>
     * This accessor method returns a reference to the live list,
     * not a snapshot. Therefore any modification you make to the
     * returned list will be present inside the JAXB object.
     * This is why there is not a <CODE>set</CODE> method for the validacionDoc property.
     * 
     * <p>
     * For example, to add a new item, do as follows:
     * <pre>
     *    getValidacionDoc().add(newItem);
     * </pre>
     * 
     * 
     * <p>
     * Objects of the following type(s) are allowed in the list
     * {@link ValidacionDoc }
     * 
     * 
     */
    public List<ValidacionDoc> getValidacionDoc() {
        if (validacionDoc == null) {
            validacionDoc = new ArrayList<ValidacionDoc>();
        }
        return this.validacionDoc;
    }

}
